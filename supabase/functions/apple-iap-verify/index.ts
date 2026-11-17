// @ts-nocheck
// Vérification d'un achat App Store (application iPhone) — côté serveur.
//
// Produits Apple : abonnements NON RENOUVELABLES (même principe que les forfaits prépayés de
// Google Play : pas de prélèvement automatique, le client renouvelle lui-même).
//
// L'application envoie la preuve d'achat signée par Apple (StoreKit 2, jwsRepresentation). Le serveur :
//   1. vérifie la signature et la chaîne de certificats Apple (_shared/apple-jws.ts) — aucune clé
//      d'API n'est nécessaire ;
//   2. vérifie : notre application, un produit connu (la formule est déduite du produit acheté,
//      jamais de ce qu'annonce l'application), achat non remboursé, et lié à CE compte
//      (appAccountToken = UUID dérivé de l'identifiant utilisateur) ;
//   3. active la période (apply_paid_period, idempotente : « apple:<transactionId> » sert de référence).
// Les achats de l'environnement de test d'Apple (« Sandbox », utilisé aussi par l'équipe d'examen
// d'Apple) sont acceptés et marqués test = true.
// Tant que le réglage apple_iap_enabled est désactivé, seuls les administrateurs passent.
import { createClient } from "npm:@supabase/supabase-js@2";
import { AppleJwsError, appleAccountToken, verifyAppleJws } from "../_shared/apple-jws.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const BUNDLE_ID = "com.kmgbibliotheque.app";
// Produit App Store → formule KMG (mêmes identifiants que src/lib/app-store.ts).
const PRODUCT_TO_PLAN: Record<string, string> = {
  "com.kmgbibliotheque.premium.mensuel": "premium_monthly",
  "com.kmgbibliotheque.premium.annuel": "premium_yearly",
};

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const { data: u } = token ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token) : { data: null };
    const user = u?.user;
    if (!user) return json({ error: "Connectez-vous pour valider votre achat." }, 401);

    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const { data: setting } = await admin.from("site_settings").select("value").eq("key", "apple_iap_enabled").maybeSingle();
    if (setting?.value !== "true" && !role) return json({ error: "Le paiement App Store n'est pas encore ouvert." }, 403);

    const body = await req.json().catch(() => ({}));
    const jws = typeof body?.jws === "string" ? body.jws.trim() : "";
    if (!jws || jws.length > 20000) return json({ error: "Preuve d'achat invalide" }, 400);

    let t;
    try {
      t = await verifyAppleJws(jws);
    } catch (e) {
      console.error("apple-iap-verify : preuve refusée", e?.message);
      return json({ error: e instanceof AppleJwsError ? "Preuve d'achat non reconnue par Apple." : "Vérification impossible." }, 400);
    }

    const transactionId = String(t.transactionId ?? "");
    const productId = String(t.productId ?? "");
    const planCode = PRODUCT_TO_PLAN[productId];
    const { data: plan } = planCode
      ? await admin.from("subscription_plans").select("*").eq("code", planCode).maybeSingle()
      : { data: null };
    const reference = `apple:${transactionId}`;
    const test = t.environment !== "Production";

    const problems: string[] = [];
    if (t.bundleId !== BUNDLE_ID) problems.push(`application ${t.bundleId}`);
    if (!transactionId) problems.push("transaction absente");
    if (!plan) problems.push(`produit inconnu ${productId}`);
    if (t.type && t.type !== "Non-Renewing Subscription") problems.push(`type ${t.type}`);
    if (t.revocationDate) problems.push("achat remboursé ou annulé");
    if (String(t.appAccountToken ?? "").toLowerCase() !== (await appleAccountToken(user.id))) problems.push("achat lié à un autre compte");
    if (problems.length) {
      if (transactionId) {
        await admin.from("payments").upsert({
          user_id: user.id, plan_id: plan?.id ?? null, payment_provider: "apple_iap", provider_reference: reference,
          amount: plan?.price_amount ?? null, currency: plan?.currency ?? null, status: "failed",
          failure_reason: `Vérification refusée : ${problems.join(", ")}`.slice(0, 1000),
          provider_data: { product_id: productId, environment: t.environment ?? null, test },
        }, { onConflict: "payment_provider,provider_reference", ignoreDuplicates: true });
      }
      return json({ error: "Cet achat ne peut pas être validé.", details: problems }, 400);
    }

    // Montant réellement payé (Apple : en millièmes d'unité, dans la devise du client).
    const paid = typeof t.price === "number" && typeof t.currency === "string" ? { amount: t.price / 1000, currency: t.currency } : null;
    const { data: sub, error: rpcErr } = await admin.rpc("apply_paid_period", {
      _user_id: user.id,
      _plan_id: plan.id,
      _provider: "apple_iap",
      _provider_reference: reference,
      _amount: paid?.amount ?? plan.price_amount,
      _currency: paid?.currency ?? plan.currency,
      _provider_data: {
        transaction_id: transactionId,
        original_transaction_id: t.originalTransactionId ?? null,
        product_id: productId,
        purchase_date: t.purchaseDate ?? null,
        storefront: t.storefront ?? null,
        environment: t.environment ?? null,
        test,
      },
    });
    if (rpcErr) throw new Error(`Activation impossible : ${rpcErr.message}`);

    const { data: expires } = await admin.rpc("premium_expires_at", { _user_id: user.id });
    return json({ success: true, plan: plan.name, period_end: sub?.expires_at ?? null, premium_expires_at: expires ?? null, test });
  } catch (e) {
    console.error("apple-iap-verify", e);
    return json({ error: "La vérification de l'achat a échoué. Réessayez : votre achat n'est pas perdu." }, 500);
  }
});

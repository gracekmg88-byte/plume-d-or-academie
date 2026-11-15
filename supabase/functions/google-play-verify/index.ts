// @ts-nocheck
// Vérification d'un achat Google Play (forfaits PRÉPAYÉS de l'abonnement Premium) — côté serveur.
//
// L'application envoie le jeton d'achat (purchaseToken) reçu de Google Play. Le serveur :
//   1. interroge l'API Google Play Developer : purchases.subscriptionsv2.get ;
//   2. vérifie : abonnement ACTIF, bon produit, forfait de base connu (la formule est déduite du
//      forfait acheté, jamais de ce qu'annonce l'application), forfait PRÉPAYÉ, et achat lié à ce
//      compte (obfuscatedExternalAccountId = empreinte de l'identifiant utilisateur) ;
//   3. active la période (apply_paid_period, idempotente : la commande Google « GPA.… » sert de
//      référence ; une recharge = nouvelle commande = nouvelle période ajoutée à la fin) ;
//   4. confirme l'achat à Google (acknowledge) — sans quoi Google le rembourse sous 3 jours.
// Tant que le réglage google_play_enabled est désactivé, seuls les administrateurs passent.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PACKAGE_NAME = Deno.env.get("ANDROID_PACKAGE_NAME") ?? "app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869";
const API = "https://androidpublisher.googleapis.com/androidpublisher/v3";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

/** Empreinte du compte transmise à Google Play à l'achat (appAccountToken) — même calcul que l'appli. */
export async function accountHash(userId: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`kmg-premium:${userId}`));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 64);
}

async function googleAccessToken(): Promise<string> {
  const sa = JSON.parse(Deno.env.get("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON") ?? "null");
  if (!sa?.client_email || !sa?.private_key) throw new Error("Compte de service Google Play non configuré (GOOGLE_PLAY_SERVICE_ACCOUNT_JSON)");
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/androidpublisher",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const t = await r.json();
  if (!t.access_token) throw new Error("Accès à l'API Google Play refusé (compte de service)");
  return t.access_token;
}

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
    const { data: setting } = await admin.from("site_settings").select("value").eq("key", "google_play_enabled").maybeSingle();
    if (setting?.value !== "true" && !role) return json({ error: "Le paiement Google Play n'est pas encore ouvert." }, 403);

    const body = await req.json().catch(() => ({}));
    const purchaseToken = typeof body?.purchase_token === "string" ? body.purchase_token.trim() : "";
    if (!purchaseToken || purchaseToken.length > 4096) return json({ error: "Jeton d'achat invalide" }, 400);

    const access = await googleAccessToken();
    const gRes = await fetch(`${API}/applications/${PACKAGE_NAME}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, {
      headers: { Authorization: `Bearer ${access}` },
    });
    const g = await gRes.json().catch(() => ({}));
    if (!gRes.ok) {
      console.error("google-play-verify : API", gRes.status, g?.error?.message);
      return json({ error: "Achat introuvable chez Google Play." }, 400);
    }

    const line = (g.lineItems ?? [])[0] ?? {};
    const productId = line.productId;
    const basePlanId = line.offerDetails?.basePlanId;
    const state = g.subscriptionState;
    const orderId = line.latestSuccessfulOrderId || g.latestOrderId;
    const expectedHash = await accountHash(user.id);
    const accountId = g.externalAccountIdentifiers?.obfuscatedExternalAccountId;

    // La formule est déduite du forfait réellement acheté chez Google.
    const { data: plan } = await admin.from("subscription_plans").select("*")
      .eq("google_play_product_id", productId).eq("google_play_base_plan_id", basePlanId).maybeSingle();

    const problems: string[] = [];
    if (state !== "SUBSCRIPTION_STATE_ACTIVE") problems.push(`état ${state}`);
    if (!plan) problems.push(`forfait inconnu ${productId}/${basePlanId}`);
    if (!line.prepaidPlan) problems.push("forfait non prépayé");
    if (!orderId) problems.push("commande absente");
    if (accountId !== expectedHash) problems.push("achat lié à un autre compte");
    if (problems.length) {
      if (orderId) {
        await admin.from("payments").upsert({
          user_id: user.id, plan_id: plan?.id ?? null, payment_provider: "google_play", provider_reference: orderId,
          amount: plan?.price_amount ?? null, currency: plan?.currency ?? null, status: "failed",
          failure_reason: `Vérification refusée : ${problems.join(", ")}`.slice(0, 1000),
          provider_data: { product_id: productId, base_plan_id: basePlanId, state, test: !!g.testPurchase },
        }, { onConflict: "payment_provider,provider_reference", ignoreDuplicates: true });
      }
      return json({ error: "Cet achat ne peut pas être validé.", details: problems }, 400);
    }

    const { data: sub, error: rpcErr } = await admin.rpc("apply_paid_period", {
      _user_id: user.id,
      _plan_id: plan.id,
      _provider: "google_play",
      _provider_reference: orderId,
      _amount: plan.price_amount,
      _currency: plan.currency,
      _provider_data: {
        purchase_token: purchaseToken,
        product_id: productId,
        base_plan_id: basePlanId,
        google_expiry_time: line.expiryTime ?? null,
        region: g.regionCode ?? null,
        test: !!g.testPurchase,
      },
    });
    if (rpcErr) throw new Error(`Activation impossible : ${rpcErr.message}`);

    // Confirmation à Google (obligatoire sous 3 jours, sinon remboursement automatique).
    if (g.acknowledgementState !== "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED") {
      const ack = await fetch(`${API}/applications/${PACKAGE_NAME}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, {
        method: "POST", headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" }, body: "{}",
      });
      if (!ack.ok) {
        const t = await ack.text();
        await admin.from("payments").update({ failure_reason: `Premium activé, mais confirmation Google à refaire : HTTP ${ack.status} ${t.slice(0, 200)}` })
          .eq("payment_provider", "google_play").eq("provider_reference", orderId);
      }
    }

    const { data: expires } = await admin.rpc("premium_expires_at", { _user_id: user.id });
    return json({ success: true, plan: plan.name, period_end: sub?.expires_at ?? null, premium_expires_at: expires ?? null, test: !!g.testPurchase });
  } catch (e) {
    console.error("google-play-verify", e);
    return json({ error: "La vérification de l'achat a échoué. Réessayez : votre achat n'est pas perdu." }, 500);
  }
});

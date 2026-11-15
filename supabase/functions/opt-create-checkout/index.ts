// @ts-nocheck
// Crée une page de paiement OPTGateway (carte Visa / Mastercard) pour une formule Premium.
//  • Le montant et la devise viennent de la base (formule), jamais du navigateur.
//  • Un paiement « en attente » est enregistré AVANT la redirection, avec une référence unique.
//  • Le Premium n'est PAS activé ici : il l'est par le webhook / la page de retour, après
//    vérification du paiement auprès d'OPTGateway (voir _shared/opt-confirm.ts).
//  • Tant que le réglage opt_gateway_enabled est désactivé, seuls les administrateurs peuvent
//    créer un paiement (tests en mode sk_test_).
import { createClient } from "npm:@supabase/supabase-js@2";
import { OptApiError, optAmount, optMode, optRequest } from "../_shared/optgateway.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.kmgbibliotheque.com").replace(/\/+$/, "");

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
  let paymentId: string | null = null;

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const { data: u } = token ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token) : { data: null };
    const user = u?.user;
    if (!user) return json({ error: "Connectez-vous pour payer." }, 401);

    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    const isAdmin = !!role;
    const { data: setting } = await admin.from("site_settings").select("value").eq("key", "opt_gateway_enabled").maybeSingle();
    if (setting?.value !== "true" && !isAdmin) {
      return json({ error: "Le paiement par carte n'est pas encore ouvert." }, 403);
    }
    if (!optMode()) return json({ error: "Paiement par carte non configuré (clé manquante)." }, 503);

    const body = await req.json().catch(() => ({}));
    const planCode = typeof body?.plan_code === "string" ? body.plan_code : "";
    const { data: plan } = await admin.from("subscription_plans").select("*").eq("code", planCode).maybeSingle();
    // Formule active avec prix ; un admin peut tester une formule encore désactivée.
    if (!plan || plan.price_amount == null || (!plan.is_active && !isAdmin)) return json({ error: "Formule indisponible." }, 400);
    if (!["CDF", "USD"].includes(plan.currency)) return json({ error: "Devise non prise en charge par le paiement par carte (CDF ou USD)." }, 400);

    const reference = `KMG-${Date.now()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    const amount = optAmount(Number(plan.price_amount), plan.currency);

    const { data: pay, error: payErr } = await admin.from("payments").insert({
      user_id: user.id,
      plan_id: plan.id,
      payment_provider: "opt_gateway",
      provider_reference: reference,
      amount: Number(amount),
      currency: plan.currency,
      status: "pending",
      provider_data: { mode: optMode() },
    }).select("id").single();
    if (payErr) throw payErr;
    paymentId = pay.id;

    const session = await optRequest("POST", "/v1/checkout/sessions", {
      amount,
      currency: plan.currency,
      reference,
      description: `KMG Bibliothèque — ${plan.name} (${plan.duration_days} jours)`,
      methods: ["card"],
      return_url: `${SITE_URL}/abonnement/retour?ref=${encodeURIComponent(reference)}`,
      cancel_url: `${SITE_URL}/abonnement/retour?ref=${encodeURIComponent(reference)}&annule=1`,
      metadata: { payment_id: pay.id, plan_code: plan.code },
      expires_in_minutes: 60,
    });
    if (!session?.id || !session?.url) throw new Error("Réponse OPTGateway incomplète");

    await admin.from("payments").update({
      provider_data: { mode: optMode(), session_id: session.id, checkout_url: session.url, session_status: session.status ?? null },
    }).eq("id", pay.id);

    await admin.from("audit_log").insert({
      user_id: user.id, action: "opt_checkout_created", table_name: "payments", record_id: pay.id,
      new_value: `${reference} · ${amount} ${plan.currency} · ${plan.code} · ${optMode()}`,
    });

    return json({ url: session.url, reference, mode: optMode() });
  } catch (e) {
    console.error("opt-create-checkout", e);
    const msg = e instanceof OptApiError ? `${e.message}${e.code ? ` (${e.code})` : ""}` : e instanceof Error ? e.message : "Erreur";
    if (paymentId) {
      await admin.from("payments").update({ status: "failed", failure_reason: `Création de la page de paiement : ${msg}`.slice(0, 1000) }).eq("id", paymentId);
    }
    return json({ error: "Le paiement n'a pas pu être lancé. Réessayez dans quelques instants." }, 502);
  }
});

// @ts-nocheck
// Crée un paiement OPTGateway pour une formule Premium : carte Visa / Mastercard (redirection vers la
// page bancaire) ou mobile money RDC — M-Pesa, Orange Money, Airtel Money (le client confirme sur son
// téléphone avec son code PIN ; l'opérateur est détecté par OPTGateway à partir du numéro).
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

/** Numéro RDC → format international +243XXXXXXXXX (accepte 0XXXXXXXXX, 243…, +243…, espaces). */
export function normalizeDrcPhone(input: unknown): string | null {
  if (typeof input !== "string") return null;
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+")) d = d.slice(1);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("243")) d = d.slice(3);
  if (d.startsWith("0")) d = d.slice(1);
  return /^[89]\d{8}$/.test(d) ? `+243${d}` : null;
}

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
    const method = body?.method === "mobile_money" ? "mobile_money" : "card";
    const phone = method === "mobile_money" ? normalizeDrcPhone(body?.phone) : null;
    if (method === "mobile_money" && !phone) {
      return json({ error: "Numéro de téléphone invalide. Exemple : 0812345678 ou +243812345678 (M-Pesa, Orange Money, Airtel Money)." }, 400);
    }
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
      provider_data: { mode: optMode(), method, ...(phone ? { phone_end: phone.slice(-3) } : {}) },
    }).select("id").single();
    if (payErr) throw payErr;
    paymentId = pay.id;

    // Paiement direct par carte (POST /v1/payments) : OPTGateway renvoie l'adresse de la page
    // bancaire sécurisée (next_action.type = "redirect"). Utilisé à la place de la page hébergée,
    // dont l'étape carte refusait le return_url de la session (« return_url obligatoire pour
    // Carte bancaire », signalé au prestataire).
    const common = {
      amount,
      currency: plan.currency,
      reference,
      description: `KMG Bibliothèque — ${plan.name} (${plan.duration_days} jours)`,
      metadata: { payment_id: pay.id, plan_code: plan.code },
    };
    let created;
    try {
      created = await optRequest("POST", "/v1/payments", method === "mobile_money"
        ? { ...common, method: "mobile_money", customer: { phone } }
        : { ...common, method: "card", return_url: `${SITE_URL}/abonnement/retour/${encodeURIComponent(reference)}` });
    } catch (e) {
      // Numéro refusé par OPTGateway (opérateur non reconnu, numéro invalide) : message clair au client.
      if (method === "mobile_money" && e instanceof OptApiError && e.status >= 400 && e.status < 500) {
        await admin.from("payments").update({ status: "failed", failure_reason: `Mobile money refusé : ${e.message}${e.code ? ` (${e.code})` : ""}`.slice(0, 1000) }).eq("id", pay.id);
        paymentId = null;
        return json({ error: e.code === "operator_unknown"
          ? "Opérateur non reconnu pour ce numéro. Utilisez un numéro M-Pesa, Orange Money ou Airtel Money."
          : "Ce numéro ne peut pas être utilisé pour le paiement mobile money. Vérifiez-le et réessayez." }, 400);
      }
      throw e;
    }
    const nextType = created?.next_action?.type ?? null;
    const redirectUrl = nextType === "redirect" ? created.next_action.url : null;
    if (!created?.id || (method === "card" && !redirectUrl)) {
      throw new Error(`Réponse OPTGateway inattendue (next_action : ${nextType ?? "absent"})`);
    }

    await admin.from("payments").update({
      provider_data: {
        mode: optMode(), method, flow: "direct", payment_id: created.id, remote_status: created.status ?? null,
        operator: created.operator ?? null, amount_charged: created.amount_charged ?? null, fees: created.fees ?? null,
        ...(phone ? { phone_end: phone.slice(-3) } : {}),
      },
    }).eq("id", pay.id);

    await admin.from("audit_log").insert({
      user_id: user.id, action: "opt_checkout_created", table_name: "payments", record_id: pay.id,
      new_value: `${reference} · ${amount} ${plan.currency} · ${plan.code} · ${method} · ${optMode()}`,
    });

    // Carte : redirection vers la banque. Mobile money : le client confirme sur son téléphone,
    // la page de retour suit l'état du paiement (webhook + vérification serveur).
    return json({
      url: redirectUrl, reference, mode: optMode(), method,
      operator: created.operator ?? null,
      amount_charged: created.amount_charged ?? null,
    });
  } catch (e) {
    console.error("opt-create-checkout", e);
    const msg = e instanceof OptApiError ? `${e.message}${e.code ? ` (${e.code})` : ""}` : e instanceof Error ? e.message : "Erreur";
    if (paymentId) {
      await admin.from("payments").update({ status: "failed", failure_reason: `Création de la page de paiement : ${msg}`.slice(0, 1000) }).eq("id", paymentId);
    }
    return json({ error: "Le paiement n'a pas pu être lancé. Réessayez dans quelques instants." }, 502);
  }
});

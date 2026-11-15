// @ts-nocheck
// Page de retour après paiement : statut d'un paiement du compte connecté.
// Si le paiement est encore « en attente » (webhook pas encore reçu), le serveur interroge
// lui-même OPTGateway et active le Premium si le paiement est confirmé — jamais sur la base
// d'un paramètre de l'adresse de retour.
import { createClient } from "npm:@supabase/supabase-js@2";
import { confirmOptPayment } from "../_shared/opt-confirm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

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
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const { data: u } = token ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token) : { data: null };
    const user = u?.user;
    if (!user) return json({ error: "Non authentifié" }, 401);

    const body = await req.json().catch(() => ({}));
    const reference = typeof body?.reference === "string" ? body.reference.slice(0, 120) : "";
    if (!reference) return json({ error: "Référence manquante" }, 400);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: payment } = await admin.from("payments").select("*")
      .eq("payment_provider", "opt_gateway").eq("provider_reference", reference).eq("user_id", user.id).maybeSingle();
    if (!payment) return json({ error: "Paiement introuvable" }, 404);

    let status = payment.status;
    if (status === "pending") {
      try { status = (await confirmOptPayment(admin, payment)).status; } catch (e) { console.error("opt-payment-status", e); }
    }
    const { data: expires } = await admin.rpc("premium_expires_at", { _user_id: user.id });
    const { data: plan } = payment.plan_id ? await admin.from("subscription_plans").select("name").eq("id", payment.plan_id).maybeSingle() : { data: null };
    return json({ status, amount: payment.amount, currency: payment.currency, plan: plan?.name ?? null, premium_expires_at: expires ?? null });
  } catch (e) {
    console.error("opt-payment-status", e);
    return json({ error: "Erreur serveur" }, 500);
  }
});

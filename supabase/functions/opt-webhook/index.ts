// @ts-nocheck
// Webhook OPTGateway (adresse à déclarer dans l'espace marchand → Webhooks).
//  1. Signature vérifiée (OPTGateway-Signature : HMAC-SHA256 de « t.corps », < 5 min).
//  2. Événement enregistré dans payment_events : un même événement n'est traité qu'une fois.
//  3. Paiement retrouvé par sa référence, puis CONFIRMÉ en interrogeant l'API OPTGateway
//     (jamais sur la seule foi du message) → activation du Premium (apply_paid_period).
// Répond toujours vite (2xx) pour les événements valides, même en cas d'erreur métier
// (consignée dans payment_events) : OPTGateway réessaie sinon jusqu'à 8 fois.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyOptSignature, sanitizeOpt } from "../_shared/optgateway.ts";
import { confirmOptPayment } from "../_shared/opt-confirm.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ok = (data: unknown = { received: true }) => new Response(JSON.stringify(data), { status: 200, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Méthode non autorisée", { status: 405 });
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
  const raw = await req.text();
  const signature = req.headers.get("OPTGateway-Signature");
  const secret = Deno.env.get("OPTGATEWAY_WEBHOOK_SECRET") ?? "";

  let event: any = null;
  try { event = JSON.parse(raw); } catch { /* corps illisible */ }

  const valid = await verifyOptSignature(raw, signature, secret);
  if (!valid) {
    // Trace de la tentative rejetée (sans traitement).
    await admin.from("payment_events").insert({
      payment_provider: "opt_gateway",
      event_id: `rejete-${crypto.randomUUID()}`,
      event_type: typeof event?.type === "string" ? event.type.slice(0, 200) : null,
      payload: null,
      signature_valid: false,
      processing_error: secret ? "Signature invalide ou trop ancienne" : "Secret de webhook non configuré",
    });
    return new Response(JSON.stringify({ error: "Signature invalide" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const eventId = String(event?.id ?? "").slice(0, 300);
  const type = String(event?.type ?? "");
  if (!eventId || !type) return new Response(JSON.stringify({ error: "Événement incomplet" }), { status: 400 });

  // Anti-doublon : un événement déjà traité est ignoré.
  const { data: inserted } = await admin.from("payment_events").insert({
    payment_provider: "opt_gateway",
    event_id: eventId,
    event_type: type.slice(0, 200),
    payload: { type, data: sanitizeOpt(event?.data) },
    signature_valid: true,
  }).select("id").maybeSingle();
  let rowId = inserted?.id;
  if (!rowId) {
    const { data: existing } = await admin.from("payment_events").select("id, processed_at").eq("payment_provider", "opt_gateway").eq("event_id", eventId).maybeSingle();
    if (existing?.processed_at) return ok({ received: true, duplicate: true });
    rowId = existing?.id;
  }

  let processingError: string | null = null;
  try {
    const reference = event?.data?.reference;
    if (!reference) throw new Error("Référence absente de l'événement");
    const { data: payment } = await admin.from("payments").select("*").eq("payment_provider", "opt_gateway").eq("provider_reference", reference).maybeSingle();
    if (!payment) throw new Error(`Référence inconnue : ${String(reference).slice(0, 80)}`);

    if (["checkout.session.completed", "payment.succeeded", "checkout.session.expired", "checkout.session.cancelled", "payment.failed", "payment.expired", "payment.cancelled"].includes(type)) {
      const r = await confirmOptPayment(admin, payment);
      // Échec signalé par OPTGateway alors que la session n'est pas encore close : on consigne.
      if (r.status === "pending" && ["payment.failed", "payment.expired", "payment.cancelled"].includes(type)) {
        await admin.from("payments").update({ failure_reason: `Tentative refusée (${type})` }).eq("id", payment.id).eq("status", "pending");
      }
    } else if (type === "payment.refunded") {
      await admin.from("payments").update({ status: "refunded" }).eq("id", payment.id);
      processingError = "Remboursement reçu : vérifier s'il faut retirer la période Premium (Admin → Premium).";
    }
  } catch (e) {
    processingError = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
    console.error("opt-webhook", processingError);
  }

  if (rowId) await admin.from("payment_events").update({ processed_at: new Date().toISOString(), processing_error: processingError }).eq("id", rowId);
  return ok();
});

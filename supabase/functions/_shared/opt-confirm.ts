// @ts-nocheck
// Confirmation d'un paiement OPTGateway CÔTÉ SERVEUR, partagée par le webhook et la page de retour.
// On n'active le Premium qu'après avoir interrogé nous-mêmes l'API OPTGateway (jamais sur la
// seule foi d'un message reçu ou d'un retour du navigateur), et seulement si la référence, le
// montant et la devise correspondent exactement à ceux enregistrés à la création du paiement.
//
// Deux formes de paiement (provider_data) :
//   • paiement direct (flow « direct », payment_id) : GET /v1/payments/:id
//     statuts : pending, requires_action, processing, succeeded, failed, expired, cancelled, refunded
//   • page hébergée (session_id) : GET /v1/checkout/sessions/:id — statut « completed » une fois payée
import { optRequest, sanitizeOpt } from "./optgateway.ts";

export type ConfirmResult = { status: "succeeded" | "pending" | "failed" | "cancelled" | "refunded"; detail?: string };

async function fetchRemote(payment) {
  const d = payment.provider_data ?? {};
  if (d.payment_id) {
    const p = await optRequest("GET", `/v1/payments/${encodeURIComponent(d.payment_id)}`);
    const st = String(p?.status ?? "");
    const map = { succeeded: "succeeded", failed: "failed", expired: "expired", cancelled: "cancelled", canceled: "cancelled", refunded: "refunded" };
    return { obj: p, outcome: map[st] ?? "pending", raw: st };
  }
  if (d.session_id) {
    const s = await optRequest("GET", `/v1/checkout/sessions/${encodeURIComponent(d.session_id)}`);
    const st = String(s?.status ?? "");
    const map = { completed: "succeeded", expired: "expired", cancelled: "cancelled", canceled: "cancelled" };
    return { obj: s, outcome: map[st] ?? "pending", raw: st };
  }
  return null;
}

export async function confirmOptPayment(admin, payment): Promise<ConfirmResult> {
  if (payment.status === "succeeded") return { status: "succeeded" };
  if (["failed", "cancelled", "refunded"].includes(payment.status)) return { status: payment.status };

  const remote = await fetchRemote(payment);
  if (!remote) return { status: "pending", detail: "identifiant OPTGateway inconnu" };
  const { obj, outcome, raw } = remote;
  const kept = { ...payment.provider_data, remote: sanitizeOpt(obj) };

  if (outcome === "succeeded") {
    const sameRef = obj.reference === payment.provider_reference;
    const sameCur = String(obj.currency) === String(payment.currency);
    const sameAmount = Math.abs(Number(obj.amount) - Number(payment.amount)) < 0.005;
    if (!sameRef || !sameCur || !sameAmount) {
      const reason = `Incohérence : OPTGateway ${obj.reference} ${obj.amount} ${obj.currency} ≠ paiement ${payment.provider_reference} ${payment.amount} ${payment.currency}`;
      await admin.from("payments").update({ status: "failed", failure_reason: reason, provider_data: kept }).eq("id", payment.id);
      return { status: "failed", detail: reason };
    }
    const { error } = await admin.rpc("apply_paid_period", {
      _user_id: payment.user_id,
      _plan_id: payment.plan_id,
      _provider: "opt_gateway",
      _provider_reference: payment.provider_reference,
      _amount: payment.amount,
      _currency: payment.currency,
      _provider_data: kept,
    });
    if (error) throw new Error(`Activation impossible : ${error.message}`);
    return { status: "succeeded" };
  }

  if (outcome === "expired" || outcome === "failed" || outcome === "cancelled") {
    const status = outcome === "cancelled" ? "cancelled" : "failed";
    const reason = outcome === "expired" ? "Paiement expiré sans confirmation" : outcome === "cancelled" ? "Paiement annulé par le client" : "Paiement refusé";
    await admin.from("payments").update({ status, failure_reason: reason, provider_data: kept }).eq("id", payment.id).eq("status", "pending");
    return { status };
  }

  if (outcome === "refunded") {
    await admin.from("payments").update({ status: "refunded", provider_data: kept }).eq("id", payment.id);
    return { status: "refunded" };
  }

  return { status: "pending", detail: raw || "en attente" };
}

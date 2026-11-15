// @ts-nocheck
// Confirmation d'un paiement OPTGateway CÔTÉ SERVEUR, partagée par le webhook et la page de retour.
// On n'active le Premium qu'après avoir interrogé nous-mêmes l'API OPTGateway (jamais sur la
// seule foi d'un message reçu ou d'un retour du navigateur), et seulement si le montant et la
// devise correspondent exactement à ceux enregistrés à la création du paiement.
import { optRequest, sanitizeOpt } from "./optgateway.ts";

export type ConfirmResult = { status: "succeeded" | "pending" | "failed" | "cancelled"; detail?: string };

export async function confirmOptPayment(admin, payment): Promise<ConfirmResult> {
  if (payment.status === "succeeded") return { status: "succeeded" };
  if (payment.status === "failed" || payment.status === "cancelled") return { status: payment.status };

  const sessionId = payment.provider_data?.session_id;
  if (!sessionId) return { status: "pending", detail: "session inconnue" };

  const session = await optRequest("GET", `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const st = String(session?.status ?? "");

  if (st === "completed") {
    const sameRef = session.reference === payment.provider_reference;
    const sameCur = String(session.currency) === String(payment.currency);
    const sameAmount = Math.abs(Number(session.amount) - Number(payment.amount)) < 0.005;
    if (!sameRef || !sameCur || !sameAmount) {
      const reason = `Incohérence : session ${session.reference} ${session.amount} ${session.currency} ≠ paiement ${payment.provider_reference} ${payment.amount} ${payment.currency}`;
      await admin.from("payments").update({ status: "failed", failure_reason: reason, provider_data: { ...payment.provider_data, session: sanitizeOpt(session) } }).eq("id", payment.id);
      return { status: "failed", detail: reason };
    }
    const { error } = await admin.rpc("apply_paid_period", {
      _user_id: payment.user_id,
      _plan_id: payment.plan_id,
      _provider: "opt_gateway",
      _provider_reference: payment.provider_reference,
      _amount: payment.amount,
      _currency: payment.currency,
      _provider_data: { ...payment.provider_data, session: sanitizeOpt(session) },
    });
    if (error) throw new Error(`Activation impossible : ${error.message}`);
    return { status: "succeeded" };
  }

  if (st === "expired" || st === "cancelled" || st === "canceled") {
    const status = st === "expired" ? "failed" : "cancelled";
    await admin.from("payments").update({
      status,
      failure_reason: st === "expired" ? "Page de paiement expirée sans paiement" : "Paiement annulé par le client",
      provider_data: { ...payment.provider_data, session: sanitizeOpt(session) },
    }).eq("id", payment.id).eq("status", "pending");
    return { status };
  }

  return { status: "pending", detail: st || "en attente" };
}

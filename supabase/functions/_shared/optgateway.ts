// @ts-nocheck
// OPTGateway — client minimal conforme à la documentation officielle (https://docs.optgateway.com).
//  • API : https://pay.optgateway.com — en-tête « Authorization: Bearer <clé secrète> »
//    (sk_test_… = paiements simulés, sk_live_… = paiements réels).
//  • Page de paiement hébergée : POST /v1/checkout/sessions → { id, url, status, amount, currency, reference }
//  • Statut : GET /v1/checkout/sessions/:id (status « completed » une fois payée) ; GET /v1/payments/:id
//  • Webhooks : en-tête « OPTGateway-Signature: t=<horodatage>,v1=<signature> »,
//    signature = HMAC-SHA256 (hex) de « t + "." + corps brut » avec le secret whsec_… ;
//    refuser au-delà de 5 minutes ; comparaison en temps constant ; répondre 2xx en moins de 10 s.
// Les clés ne quittent jamais le serveur (secrets Supabase OPTGATEWAY_SECRET_KEY / OPTGATEWAY_WEBHOOK_SECRET).

export const OPT_API = "https://pay.optgateway.com";

export function optSecretKey(): string {
  const key = Deno.env.get("OPTGATEWAY_SECRET_KEY") ?? "";
  if (!/^sk_(test|live)_/.test(key)) throw new Error("Clé OPTGateway absente ou invalide (secret OPTGATEWAY_SECRET_KEY)");
  return key;
}

export function optMode(): "test" | "live" | null {
  const key = Deno.env.get("OPTGATEWAY_SECRET_KEY") ?? "";
  return key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : null;
}

export class OptApiError extends Error {
  constructor(message: string, public status: number, public code?: string, public details?: unknown) {
    super(message);
  }
}

export async function optRequest(method: "GET" | "POST", path: string, body?: unknown) {
  const res = await fetch(`${OPT_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${optSecretKey()}`,
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text.slice(0, 500) }; }
  if (!res.ok) {
    const err = data?.error ?? {};
    throw new OptApiError(err.message || `OPTGateway HTTP ${res.status}`, res.status, err.code, err.details);
  }
  return data;
}

/** Montant au format attendu par OPTGateway : chaîne en unités normales (« 12.50 », « 150000 »). */
export function optAmount(value: number, currency: string): string {
  return currency === "CDF" ? String(Math.round(value)) : Number(value).toFixed(2);
}

function hex(buf: ArrayBuffer) {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Vérifie la signature d'un webhook. Renvoie true seulement si elle est valide et récente. */
export async function verifyOptSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.trim().split("=")).filter((kv) => kv.length === 2).map(([k, v]) => [k, v]),
  );
  const t = Number(parts.t);
  const sigs = header.split(",").map((p) => p.trim()).filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!Number.isFinite(t) || !sigs.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${rawBody}`)));
  return sigs.some((s) => safeEqual(s.toLowerCase(), expected));
}

/** Données du prestataire conservées : jamais de numéro de carte (on ne garde que des champs connus). */
export function sanitizeOpt(obj: any) {
  if (!obj || typeof obj !== "object") return null;
  const keep = ["id", "status", "amount", "currency", "reference", "method", "fees", "amount_charged", "fees_paid_by", "country", "created_at", "url"];
  const out: Record<string, unknown> = {};
  for (const k of keep) if (obj[k] !== undefined) out[k] = obj[k];
  return out;
}

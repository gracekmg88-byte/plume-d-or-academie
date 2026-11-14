import type { SupabaseClient } from "@supabase/supabase-js";
import { generateLocalCover } from "@/lib/cover-generator";

/**
 * Création d'une couverture depuis l'admin : d'abord l'IA (fonction generate-cover), sinon le
 * générateur sans IA. Chaque étape a une durée maximale, pour que le bouton ne tourne jamais sans
 * fin (le client Supabase peut rester bloqué sur la session quand la page a dormi longtemps).
 */

export type CoverParams = { title: string; author: string; category?: string; style?: string };

export type CoverResult =
  | { kind: "ai"; url: string }
  | { kind: "local"; file: File; reason: "billing_required" | "unavailable" };

const SESSION_TIMEOUT_MS = 5_000;
const AI_TIMEOUT_MS = 60_000; // une vraie génération par IA peut prendre 20 à 40 s

const TIMEOUT = Symbol("timeout");
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return Promise.race([p, new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), ms))]);
}

export async function requestCover(
  supabase: SupabaseClient,
  params: CoverParams,
  limits: { sessionMs?: number; aiMs?: number } = {},
): Promise<CoverResult> {
  const sessionMs = limits.sessionMs ?? SESSION_TIMEOUT_MS;
  const aiMs = limits.aiMs ?? AI_TIMEOUT_MS;
  let failure: { error?: string; code?: string } | null = null;

  try {
    // Session : si elle ne répond pas, on ne tente pas l'IA (l'appel resterait bloqué de la même façon).
    const session = await withTimeout(supabase.auth.getSession(), sessionMs);
    if (session === TIMEOUT) {
      failure = { error: "session indisponible (délai dépassé)" };
    } else if (!session.data.session) {
      failure = { error: "non connecté" };
    } else {
      const response = await withTimeout(
        supabase.functions.invoke("generate-cover", { body: params }),
        aiMs,
      );
      if (response === TIMEOUT) {
        failure = { error: "IA : délai dépassé" };
      } else if (response.error) {
        const ctx = (response.error as { context?: Response }).context;
        try {
          failure = ctx && typeof ctx.json === "function" ? await withTimeout(ctx.json(), 5_000).then((v) => (v === TIMEOUT ? null : v)) : null;
        } catch {
          failure = null;
        }
        failure = failure ?? { error: response.error.message };
      } else if (response.data?.error) {
        failure = response.data;
      } else if (response.data?.coverUrl) {
        return { kind: "ai", url: response.data.coverUrl as string };
      } else {
        failure = { error: "réponse inattendue" };
      }
    }
  } catch (e) {
    failure = { error: e instanceof Error ? e.message : String(e) };
  }

  console.warn("Couverture IA indisponible, création sans IA :", failure);
  const file = await generateLocalCover(params);
  return { kind: "local", file, reason: failure?.code === "billing_required" ? "billing_required" : "unavailable" };
}

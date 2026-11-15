import { supabase } from "@/integrations/supabase/client";

/**
 * Appel d'une fonction serveur avec durées maximales. Dans l'application Android, le client
 * Supabase peut rester bloqué sur la lecture de la session (appli restée longtemps en veille) :
 * sans limite, le bouton tournerait sans fin et la demande ne partirait jamais.
 */
const TIMEOUT = Symbol("timeout");
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT> {
  return Promise.race([p, new Promise<typeof TIMEOUT>((r) => setTimeout(() => r(TIMEOUT), ms))]);
}

export class InvokeTimeoutError extends Error {}

export async function invokeWithTimeout<T = unknown>(
  name: string,
  body: unknown,
  limits: { sessionMs?: number; callMs?: number } = {},
) {
  const session = await withTimeout(supabase.auth.getSession(), limits.sessionMs ?? 8_000);
  if (session === TIMEOUT) {
    // Seconde chance : renouveler la session, puis abandonner proprement.
    const refreshed = await withTimeout(supabase.auth.refreshSession(), 8_000);
    if (refreshed === TIMEOUT || !refreshed.data.session) {
      throw new InvokeTimeoutError("La session ne répond pas. Fermez puis rouvrez l'application, et réessayez.");
    }
  } else if (!session.data.session) {
    throw new Error("Vous n'êtes plus connecté. Reconnectez-vous puis réessayez.");
  }
  const res = await withTimeout(supabase.functions.invoke<T>(name, { body: body as Record<string, unknown> }), limits.callMs ?? 45_000);
  if (res === TIMEOUT) throw new InvokeTimeoutError("Le serveur ne répond pas (délai dépassé). Vérifiez la connexion et réessayez.");
  return res;
}

import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Délai maximal d'un enregistrement : au-delà, l'admin voit une erreur au lieu d'une attente sans fin. */
const SAVE_TIMEOUT_MS = 15_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Le serveur ne répond pas. Vérifiez la connexion et réessayez.")),
      ms,
    );
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Enregistre un réglage de `site_settings` (mise à jour, ou création si la ligne n'existe pas)
 * et vérifie que la base a réellement accepté la modification : une règle d'accès qui refuse
 * en silence (0 ligne modifiée) devient une erreur visible.
 */
export async function saveSiteSetting(key: string, value: string, label: string): Promise<void> {
  const save = async () => {
    const { data: updated, error } = await supabase
      .from("site_settings")
      .update({ value })
      .eq("key", key)
      .select("value");
    if (error) throw error;
    if (updated && updated.length > 0) return;

    // Aucune ligne modifiée : soit elle n'existe pas encore, soit l'accès est refusé.
    const { data: inserted, error: insertError } = await supabase
      .from("site_settings")
      .insert({ key, value, label, category: "general" })
      .select("value");
    if (insertError) {
      throw new Error(
        insertError.code === "23505"
          ? "Modification refusée : droits administrateur requis."
          : insertError.message,
      );
    }
    if (!inserted || inserted.length === 0) {
      throw new Error("Modification refusée : droits administrateur requis.");
    }
  };
  await withTimeout(save(), SAVE_TIMEOUT_MS);
}

/**
 * Options de mutation communes aux réglages de disposition : la sélection change immédiatement
 * (mise à jour optimiste), revient à l'ancienne valeur en cas d'échec, puis est relue en base.
 */
export function optimisticSettingMutation<T extends string>(
  queryClient: QueryClient,
  queryKey: readonly unknown[],
  key: string,
  label: string,
) {
  return {
    mutationFn: (next: T) => saveSiteSetting(key, next, label),
    onMutate: async (next: T) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<T>(queryKey);
      queryClient.setQueryData<T>(queryKey, next);
      return { previous };
    },
    onError: (_error: unknown, _next: T, context: { previous?: T } | undefined) => {
      if (context && context.previous !== undefined) {
        queryClient.setQueryData<T>(queryKey, context.previous);
      }
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Publication = Tables<"publications">;
export type PublicationInsert = TablesInsert<"publications">;
export type PublicationUpdate = TablesUpdate<"publications">;

type ContentCategory = "livre" | "memoire" | "tfc" | "article";

export async function fetchPublication(id: string) {
  const { data, error } = await supabase
    .from("publications")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Dernière liste reçue, gardée sur l'appareil : si le réseau rate (4G instable, onglet
// réveillé après une pause), on affiche ces publications au lieu d'une page vide.
const LIST_CACHE_PREFIX = "kmg-publications-list-v1:";
const REQUEST_TIMEOUT_MS = 20_000;
const ERROR_RETRY_INTERVAL_MS = 20_000;

function readCachedList(category?: string): Publication[] | undefined {
  try {
    const raw = localStorage.getItem(`${LIST_CACHE_PREFIX}${category ?? "all"}`);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as Publication[]) : undefined;
  } catch {
    return undefined;
  }
}

function writeCachedList(category: string | undefined, list: Publication[]) {
  try {
    localStorage.setItem(`${LIST_CACHE_PREFIX}${category ?? "all"}`, JSON.stringify(list));
  } catch {
    // stockage plein ou bloqué : sans gravité, la liste reste affichée normalement
  }
}

export function usePublications(category?: string) {
  const query = useQuery({
    queryKey: ["publications", category],
    queryFn: async ({ signal }) => {
      // Une demande bloquée (réseau figé) est abandonnée au bout de 20 s pour être relancée,
      // au lieu de laisser la page attendre indéfiniment.
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      const onAbort = () => controller.abort();
      signal?.addEventListener("abort", onAbort);

      try {
        let request = supabase
          .from("publications")
          .select("*")
          .eq("is_published", true)
          .order("created_at", { ascending: false });

        if (category && category !== "all") {
          request = request.eq("category", category as ContentCategory);
        }

        const { data, error } = await request.abortSignal(controller.signal);
        if (error) throw error;
        const list = data ?? [];
        writeCachedList(category, list);
        return list;
      } finally {
        window.clearTimeout(timer);
        signal?.removeEventListener("abort", onAbort);
      }
    },
    // Liste gardée sur l'appareil : affichée tout de suite, puis remplacée par la version du serveur
    // (date 0 = considérée comme ancienne, donc rechargée immédiatement).
    initialData: () => readCachedList(category),
    initialDataUpdatedAt: 0,
    // Une coupure passagère ne doit pas afficher une bibliothèque vide : 5 nouvelles tentatives
    // en patientant 1 s, 2 s, 4 s, 8 s puis 8 s.
    retry: 5,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    // Tant que le chargement échoue : nouvel essai toutes les 20 s et dès le retour sur l'onglet.
    // (Le retour du réseau relance déjà le chargement : refetchOnReconnect dans App.tsx.)
    refetchInterval: (q) => (q.state.status === "error" ? ERROR_RETRY_INTERVAL_MS : false),
    refetchOnWindowFocus: (q) => q.state.status === "error",
  });

  return {
    ...query,
    // Le serveur n'a pas pu être joint, mais une liste précédente est affichée.
    isShowingCachedList: query.isError && (query.data?.length ?? 0) > 0,
  };
}

export function usePublication(id: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["publication", id],
    queryFn: () => fetchPublication(id),
    enabled: !!id,
    staleTime: 60_000,
    // Seed from any cached list so the page renders instantly without a spinner
    initialData: () => {
      if (!id) return undefined;
      const caches = queryClient.getQueriesData<Publication[]>({ queryKey: ["publications"] });
      for (const [, list] of caches) {
        const hit = list?.find((p) => p.id === id);
        if (hit) return hit as Publication;
      }
      const adminLists = queryClient.getQueriesData<Publication[]>({ queryKey: ["admin-publications"] });
      for (const [, list] of adminLists) {
        const hit = list?.find((p) => p.id === id);
        if (hit) return hit as Publication;
      }
      return undefined;
    },
    initialDataUpdatedAt: () => {
      const state = queryClient.getQueryState(["publications", undefined]);
      return state?.dataUpdatedAt;
    },
  });
}

export function useAdminPublications() {
  return useQuery({
    queryKey: ["admin-publications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useCreatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publication: PublicationInsert) => {
      const { data, error } = await supabase
        .from("publications")
        .insert(publication)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-publications"] });
    },
  });
}

export function useUpdatePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: PublicationUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("publications")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["publications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-publications"] });
      queryClient.invalidateQueries({ queryKey: ["publication", variables.id] });
    },
  });
}

export function useDeletePublication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("publications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["publications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-publications"] });
    },
  });
}

export function useIncrementViews() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("increment_views", { publication_id: id });
      if (error) throw error;
    },
  });
}

export function useIncrementDownloads() {
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("increment_downloads" as any, { publication_id: id });
      if (error) throw error;
    },
  });
}


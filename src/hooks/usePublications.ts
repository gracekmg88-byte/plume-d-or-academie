import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Publication = Tables<"publications">;
export type PublicationInsert = TablesInsert<"publications">;
export type PublicationUpdate = TablesUpdate<"publications">;

type ContentCategory = "livre" | "memoire" | "tfc" | "article";

export function usePublications(category?: string) {
  return useQuery({
    queryKey: ["publications", category],
    queryFn: async () => {
      let query = supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });

      if (category && category !== "all") {
        query = query.eq("category", category as ContentCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function usePublication(id: string) {
  return useQuery({
    queryKey: ["publication", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
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
      return data;
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

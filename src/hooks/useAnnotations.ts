import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Annotation {
  id: string;
  user_id: string;
  publication_id: string;
  page_number: number;
  content: string;
  color: string;
  created_at: string;
  updated_at: string;
}

export function useAnnotations(publicationId: string) {
  const { user } = useAuth();

  const { data: annotations = [], isLoading } = useQuery({
    queryKey: ["annotations", publicationId, user?.id],
    enabled: !!user && !!publicationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("annotations")
        .select("*")
        .eq("publication_id", publicationId)
        .eq("user_id", user!.id)
        .order("page_number", { ascending: true });
      if (error) throw error;
      return data as Annotation[];
    },
  });

  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["annotations", publicationId] });

  const addAnnotation = useMutation({
    mutationFn: async ({ pageNumber, content, color }: { pageNumber: number; content: string; color?: string }) => {
      if (!user) throw new Error("Non connecté");
      const { data, error } = await supabase
        .from("annotations")
        .insert({
          user_id: user.id,
          publication_id: publicationId,
          page_number: pageNumber,
          content,
          color: color || "#FDE047",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: invalidate,
  });

  const updateAnnotation = useMutation({
    mutationFn: async ({ id, content, color }: { id: string; content: string; color?: string }) => {
      const updates: any = { content, updated_at: new Date().toISOString() };
      if (color) updates.color = color;
      const { error } = await supabase.from("annotations").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const deleteAnnotation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("annotations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  const getPageAnnotations = (page: number) => annotations.filter((a) => a.page_number === page);
  const getAnnotationCount = (page: number) => annotations.filter((a) => a.page_number === page).length;

  return {
    annotations,
    isLoading,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    getPageAnnotations,
    getAnnotationCount,
  };
}

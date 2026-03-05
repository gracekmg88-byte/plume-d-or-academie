import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export function useFavorites() {
  const { user } = useAuth();

  const { data: favorites = [], isLoading } = useQuery({
    queryKey: ["favorites", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("*, publications(id, title, author, category, cover_image_url, views_count)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  return { favorites, isLoading };
}

export function useFavoriteIds() {
  const { user } = useAuth();

  const { data: favoriteIds = [], isLoading } = useQuery({
    queryKey: ["favorite-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("favorites")
        .select("publication_id")
        .eq("user_id", user!.id);

      if (error) throw error;
      return (data || []).map((f) => f.publication_id);
    },
  });

  return { favoriteIds, isLoading };
}

export function useToggleFavorite() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ publicationId, isFavorited }: { publicationId: string; isFavorited: boolean }) => {
      if (!user) throw new Error("Not authenticated");

      if (isFavorited) {
        const { error } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("publication_id", publicationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("favorites")
          .insert({ user_id: user.id, publication_id: publicationId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["favorites"] });
      queryClient.invalidateQueries({ queryKey: ["favorite-ids"] });
    },
  });
}

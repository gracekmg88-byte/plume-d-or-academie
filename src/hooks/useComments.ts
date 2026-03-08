import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Comment {
  id: string;
  publication_id: string;
  user_id: string;
  user_name: string;
  content: string;
  created_at: string;
}

export function useComments(publicationId: string) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery<Comment[]>({
    queryKey: ["comments", publicationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("comments")
        .select("*")
        .eq("publication_id", publicationId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as Comment[];
    },
    enabled: !!publicationId,
  });

  const addComment = useMutation({
    mutationFn: async (content: string) => {
      if (!user) throw new Error("Not authenticated");

      // Get user name from profile
      const { data: profile } = await supabase
        .from("user_profiles")
        .select("full_name, email")
        .eq("user_id", user.id)
        .single();

      const userName = profile?.full_name || profile?.email || "Utilisateur";

      const { error } = await supabase.from("comments").insert([{
        publication_id: publicationId,
        user_id: user.id,
        user_name: userName,
        content,
      }] as any);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", publicationId] });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase
        .from("comments")
        .delete()
        .eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["comments", publicationId] });
    },
  });

  return {
    comments,
    isLoading,
    addComment: addComment.mutateAsync,
    isAdding: addComment.isPending,
    deleteComment: deleteComment.mutate,
    canDelete: (comment: Comment) =>
      user?.id === comment.user_id || isAdmin,
  };
}

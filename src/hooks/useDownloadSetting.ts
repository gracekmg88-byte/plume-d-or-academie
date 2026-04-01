import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useDownloadSetting() {
  const queryClient = useQueryClient();

  const { data: allowDownloads = true, isLoading } = useQuery({
    queryKey: ["site-settings", "allow_downloads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "allow_downloads")
        .maybeSingle();
      if (error) throw error;
      return data?.value !== "false";
    },
    staleTime: 30_000,
  });

  const toggleDownload = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from("site_settings")
        .update({ value: enabled ? "true" : "false" })
        .eq("key", "allow_downloads");
      if (error) throw error;

      // Notify all users about the change
      const { data: users } = await supabase
        .from("user_profiles")
        .select("user_id");

      if (users && users.length > 0) {
        const notifications = users.map((u) => ({
          user_id: u.user_id,
          title: enabled ? "📥 Téléchargement activé" : "🔒 Téléchargement désactivé",
          message: enabled
            ? "Le téléchargement des documents est maintenant disponible."
            : "Les documents sont maintenant en lecture seule.",
          type: "system",
        }));
        await supabase.from("notifications").insert(notifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "allow_downloads"] });
    },
  });

  return { allowDownloads, isLoading, toggleDownload };
}

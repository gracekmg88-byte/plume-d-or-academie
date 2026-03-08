import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

const ALL_CATEGORIES = ["livre", "memoire", "tfc", "article", "chat"] as const;

export type NotificationCategory = (typeof ALL_CATEGORIES)[number];

export function useNotificationPreferences() {
  const { user } = useAuth();

  const { data: preferences, isLoading } = useQuery({
    queryKey: ["notification-preferences", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_preferences")
        .select("*")
        .eq("user_id", user!.id);

      if (error) throw error;
      return data || [];
    },
  });

  // If user has no preferences yet, all categories are enabled by default
  const getEnabledCategories = (): Record<NotificationCategory, boolean> => {
    const result: Record<string, boolean> = {};
    for (const cat of ALL_CATEGORIES) {
      const pref = preferences?.find((p) => p.category === cat);
      result[cat] = pref ? pref.enabled : true; // default enabled
    }
    return result as Record<NotificationCategory, boolean>;
  };

  return {
    preferences,
    enabledCategories: getEnabledCategories(),
    isLoading,
    allCategories: ALL_CATEGORIES,
  };
}

export function useToggleNotificationPreference() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      category,
      enabled,
    }: {
      category: string;
      enabled: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("notification_preferences").upsert(
        {
          user_id: user.id,
          category,
          enabled,
        },
        { onConflict: "user_id,category" }
      );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["notification-preferences"],
      });
    },
  });
}

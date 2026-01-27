import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type SubscriptionType = "free" | "premium";

export interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string | null;
  subscription_type: SubscriptionType;
  subscription_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data: profile, isLoading, error, refetch } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error);
        throw error;
      }

      return data as UserProfile | null;
    },
    enabled: !!user?.id,
  });

  const isPremium = profile?.subscription_type === "premium";
  const isFree = !profile || profile.subscription_type === "free";

  return {
    profile,
    isLoading,
    error,
    isPremium,
    isFree,
    refetch,
  };
}

// Hook for admin to manage user subscriptions
export function useAdminUsers() {
  const queryClient = useQueryClient();

  const { data: users, isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching users:", error);
        throw error;
      }

      return data as UserProfile[];
    },
  });

  const updateSubscription = useMutation({
    mutationFn: async ({
      userId,
      subscriptionType,
    }: {
      userId: string;
      subscriptionType: SubscriptionType;
    }) => {
      const { error } = await supabase
        .from("user_profiles")
        .update({
          subscription_type: subscriptionType,
          subscription_updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
    },
  });

  return {
    users,
    isLoading,
    error,
    updateSubscription,
  };
}

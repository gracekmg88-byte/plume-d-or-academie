import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeaturedPublication = Tables<"publications">;

export function useFeaturedPublications(limit = 8) {
  return useQuery<FeaturedPublication[]>({
    queryKey: ["featured-publications", limit],
    queryFn: async () => {
      // 1. Try featured-by-admin first
      const { data: featured } = await supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (featured && featured.length > 0) return featured;

      // 2. Fallback: most viewed + most recent mix
      const { data: popular } = await supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .order("views_count", { ascending: false })
        .limit(limit);

      return popular || [];
    },
    staleTime: 5 * 60 * 1000,
  });
}

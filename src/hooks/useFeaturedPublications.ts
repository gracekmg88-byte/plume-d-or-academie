import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type FeaturedPublication = Tables<"publications">;

/**
 * Smart popularity score:
 *  - views weighted x1
 *  - downloads weighted x3 (stronger intent signal)
 *  - recency bonus: +20 per week since now, capped at 8 weeks
 */
function scoreFor(pub: FeaturedPublication): number {
  const views = pub.views_count || 0;
  const downloads = (pub as any).downloads_count || 0;
  const createdAt = new Date(pub.created_at).getTime();
  const ageWeeks = Math.max(0, (Date.now() - createdAt) / (1000 * 60 * 60 * 24 * 7));
  const recencyBonus = Math.max(0, 20 * (8 - Math.min(ageWeeks, 8)));
  return views + downloads * 3 + recencyBonus;
}

export function useFeaturedPublications(limit = 8) {
  return useQuery<FeaturedPublication[]>({
    queryKey: ["featured-publications", limit],
    queryFn: async () => {
      // 1. Try admin-featured first
      const { data: featured, error: featuredErr } = await supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .eq("is_featured", true)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (featuredErr) throw featuredErr;
      if (featured && featured.length > 0) return featured;

      // 2. Smart fallback: combined views + downloads + recency
      const { data: pool, error: poolErr } = await supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .order("views_count", { ascending: false })
        .limit(limit * 4);

      if (poolErr) throw poolErr;
      if (!pool) return [];

      return [...pool]
        .sort((a, b) => scoreFor(b) - scoreFor(a))
        .slice(0, limit);
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 4,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

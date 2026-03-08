import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface Recommendation {
  id: string;
  title: string;
  author: string;
  category: string;
  cover_image_url: string | null;
  views_count: number;
}

export function useRecommendations(limit = 5) {
  const { user } = useAuth();

  return useQuery<Recommendation[]>({
    queryKey: ["recommendations", user?.id],
    queryFn: async () => {
      if (!user) {
        // For anonymous users, return most viewed publications
        const { data, error } = await supabase
          .from("publications")
          .select("id, title, author, category, cover_image_url, views_count")
          .eq("is_published", true)
          .order("views_count", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      }

      // Get user's reading history to find preferred categories
      const { data: history } = await supabase
        .from("reading_history")
        .select("publication_id")
        .eq("user_id", user.id);

      const { data: favorites } = await supabase
        .from("favorites")
        .select("publication_id")
        .eq("user_id", user.id);

      const readPubIds = new Set([
        ...(history || []).map((h) => h.publication_id),
        ...(favorites || []).map((f) => f.publication_id),
      ]);

      if (readPubIds.size === 0) {
        // No history — return popular publications
        const { data, error } = await supabase
          .from("publications")
          .select("id, title, author, category, cover_image_url, views_count")
          .eq("is_published", true)
          .order("views_count", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      }

      // Get categories from read publications
      const { data: readPubs } = await supabase
        .from("publications")
        .select("category")
        .in("id", [...readPubIds]);

      // Count category frequency
      const catCount: Record<string, number> = {};
      for (const p of readPubs || []) {
        catCount[p.category] = (catCount[p.category] || 0) + 1;
      }

      // Sort categories by frequency
      const sortedCats = Object.entries(catCount)
        .sort((a, b) => b[1] - a[1])
        .map(([cat]) => cat);

      if (sortedCats.length === 0) {
        const { data, error } = await supabase
          .from("publications")
          .select("id, title, author, category, cover_image_url, views_count")
          .eq("is_published", true)
          .order("views_count", { ascending: false })
          .limit(limit);
        if (error) throw error;
        return data || [];
      }

      // Fetch recommendations from preferred categories, excluding already read
      const { data: recommended, error } = await supabase
        .from("publications")
        .select("id, title, author, category, cover_image_url, views_count")
        .eq("is_published", true)
        .in("category", sortedCats)
        .order("views_count", { ascending: false })
        .limit(limit + readPubIds.size); // fetch extra to filter out read ones

      if (error) throw error;

      // Filter out already read/favorited, prioritize by preferred category order
      const filtered = (recommended || [])
        .filter((p) => !readPubIds.has(p.id))
        .sort((a, b) => {
          const aIdx = sortedCats.indexOf(a.category);
          const bIdx = sortedCats.indexOf(b.category);
          if (aIdx !== bIdx) return aIdx - bIdx;
          return b.views_count - a.views_count;
        })
        .slice(0, limit);

      // If not enough, fill with popular from other categories
      if (filtered.length < limit) {
        const existingIds = new Set([...readPubIds, ...filtered.map((p) => p.id)]);
        const { data: extra } = await supabase
          .from("publications")
          .select("id, title, author, category, cover_image_url, views_count")
          .eq("is_published", true)
          .order("views_count", { ascending: false })
          .limit(limit * 2);

        for (const p of extra || []) {
          if (!existingIds.has(p.id)) {
            filtered.push(p);
            existingIds.add(p.id);
          }
          if (filtered.length >= limit) break;
        }
      }

      return filtered;
    },
  });
}

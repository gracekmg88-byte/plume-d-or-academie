import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface ContinueReadingItem {
  publication_id: string;
  title: string;
  author: string;
  category: string;
  cover_image_url: string | null;
  last_page_read: number;
  started_at: string;
}

export function useContinueReading(limit = 3) {
  const { user } = useAuth();

  return useQuery<ContinueReadingItem[]>({
    queryKey: ["continue-reading", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get recent reading records that have a saved page
      const { data: history, error } = await supabase
        .from("reading_history")
        .select("publication_id, last_page_read, started_at")
        .eq("user_id", user!.id)
        .not("last_page_read", "is", null)
        .gt("last_page_read", 0)
        .order("started_at", { ascending: false });

      if (error) throw error;
      if (!history || history.length === 0) return [];

      // Deduplicate by publication_id, keep most recent
      const seen = new Set<string>();
      const unique = [];
      for (const h of history) {
        if (!seen.has(h.publication_id)) {
          seen.add(h.publication_id);
          unique.push(h);
        }
        if (unique.length >= limit) break;
      }

      // Get publication details
      const pubIds = unique.map((h) => h.publication_id);
      const { data: pubs } = await supabase
        .from("publications")
        .select("id, title, author, category, cover_image_url")
        .in("id", pubIds);

      const pubMap = new Map((pubs || []).map((p) => [p.id, p]));

      return unique
        .map((h) => {
          const pub = pubMap.get(h.publication_id);
          if (!pub) return null;
          return {
            publication_id: h.publication_id,
            title: pub.title,
            author: pub.author,
            category: pub.category,
            cover_image_url: pub.cover_image_url,
            last_page_read: h.last_page_read!,
            started_at: h.started_at,
          };
        })
        .filter(Boolean) as ContinueReadingItem[];
    },
  });
}

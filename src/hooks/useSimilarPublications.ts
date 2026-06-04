import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Publication = Tables<"publications">;
type Cat = "livre" | "memoire" | "tfc" | "article";

export function useSimilarPublications(
  id: string | undefined,
  category: string | undefined,
  author: string | undefined,
  limit = 6,
) {
  return useQuery({
    queryKey: ["similar-publications", id, category, author, limit],
    enabled: !!id && !!category,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const out: Publication[] = [];
      const seen = new Set<string>([id!]);

      if (author) {
        const { data } = await supabase
          .from("publications")
          .select("*")
          .eq("is_published", true)
          .eq("author", author)
          .neq("id", id!)
          .order("created_at", { ascending: false })
          .limit(limit);
        for (const p of data || []) {
          if (!seen.has(p.id)) {
            out.push(p);
            seen.add(p.id);
          }
        }
      }

      if (out.length < limit && category) {
        const { data } = await supabase
          .from("publications")
          .select("*")
          .eq("is_published", true)
          .eq("category", category as Cat)
          .neq("id", id!)
          .order("views_count", { ascending: false })
          .limit(limit);
        for (const p of data || []) {
          if (out.length >= limit) break;
          if (!seen.has(p.id)) {
            out.push(p);
            seen.add(p.id);
          }
        }
      }

      return out.slice(0, limit);
    },
  });
}

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { slugifyAuthor } from "@/lib/slug";

export function useAuthorPublications(slug: string | undefined) {
  return useQuery({
    queryKey: ["author-publications", slug],
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("publications")
        .select("*")
        .eq("is_published", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data || []).filter(
        (p) => slugifyAuthor(p.author || "") === slug,
      );
      return list;
    },
  });
}

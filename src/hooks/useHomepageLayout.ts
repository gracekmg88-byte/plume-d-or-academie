import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type HomepageLayout = "complet" | "epure" | "magazine" | "focus-catalogue";

export const HOMEPAGE_LAYOUT_OPTIONS: {
  value: HomepageLayout;
  label: string;
  description: string;
}[] = [
  { value: "complet", label: "Complet", description: "Carrousel, stats, recommandations, récentes, fonctionnalités et CTA (défaut)" },
  { value: "epure", label: "Épuré", description: "Carrousel + recommandations + récentes uniquement. Pas de fonctionnalités ni CTA." },
  { value: "magazine", label: "Magazine", description: "Récentes affichées avec une publication en vedette puis grille." },
  { value: "focus-catalogue", label: "Focus catalogue", description: "Met l'accent sur les publications récentes (8 au lieu de 4)." },
];

const isLayout = (v: string | undefined | null): v is HomepageLayout =>
  v === "complet" || v === "epure" || v === "magazine" || v === "focus-catalogue";

export function useHomepageLayout() {
  const queryClient = useQueryClient();

  const { data: layout = "complet" as HomepageLayout, isLoading } = useQuery({
    queryKey: ["site-settings", "homepage_layout"],
    queryFn: async (): Promise<HomepageLayout> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_layout")
        .maybeSingle();
      if (error) throw error;
      return isLayout(data?.value as any) ? ((data!.value as any) as HomepageLayout) : "complet";
    },
    staleTime: 60_000,
  });

  const setLayout = useMutation({
    mutationFn: async (next: HomepageLayout) => {
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "homepage_layout")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: next })
          .eq("key", "homepage_layout");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({
          key: "homepage_layout",
          value: next,
          label: "Disposition de la page d'accueil",
          category: "general",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "homepage_layout"] });
    },
  });

  return { layout: layout as HomepageLayout, isLoading, setLayout };
}

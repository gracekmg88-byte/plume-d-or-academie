import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { optimisticSettingMutation } from "@/lib/site-settings";

const HOMEPAGE_LAYOUT_QUERY_KEY = ["site-settings", "homepage_layout"] as const;

export type HomepageLayout = "complet" | "epure" | "magazine" | "focus-catalogue";

export const HOMEPAGE_LAYOUT_OPTIONS: {
  value: HomepageLayout;
  label: string;
  description: string;
}[] = [
  { value: "complet", label: "Complet", description: "Carrousel, stats, recommandations, récentes, fonctionnalités et CTA (défaut)" },
  { value: "epure", label: "Épuré", description: "Carrousel + recommandations + récentes uniquement. Pas de fonctionnalités ni CTA." },
  { value: "magazine", label: "Magazine", description: "Récentes affichées avec une publication en vedette puis grille." },
  { value: "focus-catalogue", label: "Focus catalogue", description: "Met l'accent sur les publications récentes (8 au lieu de 4), sans carrousel." },
];

const isLayout = (v: string | undefined | null): v is HomepageLayout =>
  v === "complet" || v === "epure" || v === "magazine" || v === "focus-catalogue";

export function useHomepageLayout() {
  const queryClient = useQueryClient();

  const { data: layout = "complet" as HomepageLayout, isLoading } = useQuery({
    queryKey: HOMEPAGE_LAYOUT_QUERY_KEY,
    queryFn: async (): Promise<HomepageLayout> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_layout")
        .maybeSingle();
      if (error) throw error;
      return isLayout(data?.value) ? (data!.value as HomepageLayout) : "complet";
    },
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Sélection immédiate, enregistrement vérifié (15 s max), retour à l'ancienne valeur en cas d'échec.
  const setLayout = useMutation(
    optimisticSettingMutation<HomepageLayout>(
      queryClient,
      HOMEPAGE_LAYOUT_QUERY_KEY,
      "homepage_layout",
      "Disposition de la page d'accueil",
    ),
  );

  return { layout: layout as HomepageLayout, isLoading, setLayout };
}

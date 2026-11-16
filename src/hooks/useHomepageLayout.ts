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

// Dernière disposition connue sur cet appareil : affichée tout de suite au lancement suivant,
// au lieu de la disposition par défaut qui disparaissait ensuite (sections qui « flashent »).
const STORAGE_KEY = "kmg:homepage_layout";
const readStored = (): HomepageLayout | undefined => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isLayout(v) ? v : undefined;
  } catch {
    return undefined;
  }
};

export function useHomepageLayout() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError, fetchStatus } = useQuery({
    queryKey: HOMEPAGE_LAYOUT_QUERY_KEY,
    queryFn: async (): Promise<HomepageLayout> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "homepage_layout")
        .maybeSingle();
      if (error) throw error;
      const value = isLayout(data?.value) ? (data!.value as HomepageLayout) : "complet";
      try { localStorage.setItem(STORAGE_KEY, value); } catch { /* stockage indisponible */ }
      return value;
    },
    initialData: readStored,
    initialDataUpdatedAt: 0, // toujours revérifiée auprès du serveur
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

  // ready : disposition connue (serveur ou dernière valeur de l'appareil). Tant qu'elle ne l'est
  // pas, les pages n'affichent pas les sections qui en dépendent (pas de contenu qui disparaît).
  return { layout: (data ?? "complet") as HomepageLayout, ready: data !== undefined || isError || fetchStatus === "paused", isLoading, setLayout }; // hors connexion : disposition par défaut
}

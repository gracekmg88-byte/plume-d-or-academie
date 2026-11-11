import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { optimisticSettingMutation } from "@/lib/site-settings";

const LIBRARY_LAYOUT_QUERY_KEY = ["site-settings", "library_layout"] as const;

export type LibraryLayout = "grid" | "compact" | "list" | "magazine";

export const LIBRARY_LAYOUT_OPTIONS: {
  value: LibraryLayout;
  label: string;
  description: string;
}[] = [
  { value: "grid", label: "Grille classique", description: "Cartes 3/4 sur 2 à 4 colonnes (défaut)" },
  { value: "compact", label: "Compact", description: "Petites cartes, jusqu'à 6 colonnes, plus de documents visibles" },
  { value: "list", label: "Liste détaillée", description: "Une publication par ligne avec description complète" },
  { value: "magazine", label: "Magazine", description: "Première publication en vedette, le reste en grille" },
];

const isLayout = (v: string | undefined | null): v is LibraryLayout =>
  v === "grid" || v === "compact" || v === "list" || v === "magazine";

export function useLibraryLayout() {
  const queryClient = useQueryClient();

  const { data: layout = "grid" as LibraryLayout, isLoading } = useQuery({
    queryKey: LIBRARY_LAYOUT_QUERY_KEY,
    queryFn: async (): Promise<LibraryLayout> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "library_layout")
        .maybeSingle();
      if (error) throw error;
      return isLayout(data?.value) ? (data!.value as LibraryLayout) : "grid";
    },
    // Même politique que la page d'accueil : un changement fait dans l'admin apparaît
    // à la prochaine ouverture de la bibliothèque ou au retour dans l'appli.
    staleTime: 10_000,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });

  // Sélection immédiate, enregistrement vérifié (15 s max), retour à l'ancienne valeur en cas d'échec.
  const setLayout = useMutation(
    optimisticSettingMutation<LibraryLayout>(
      queryClient,
      LIBRARY_LAYOUT_QUERY_KEY,
      "library_layout",
      "Disposition de la bibliothèque",
    ),
  );

  return { layout: layout as LibraryLayout, isLoading, setLayout };
}

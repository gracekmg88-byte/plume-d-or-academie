import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    queryKey: ["site-settings", "library_layout"],
    queryFn: async (): Promise<LibraryLayout> => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "library_layout")
        .maybeSingle();
      if (error) throw error;
      return isLayout(data?.value) ? (data!.value as LibraryLayout) : "grid";
    },
    staleTime: 60_000,
  });

  const setLayout = useMutation({
    mutationFn: async (next: LibraryLayout) => {
      // Try update first; if no row exists, insert it.
      const { data: existing } = await supabase
        .from("site_settings")
        .select("id")
        .eq("key", "library_layout")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("site_settings")
          .update({ value: next })
          .eq("key", "library_layout");
        if (error) throw error;
      } else {
        const { error } = await supabase.from("site_settings").insert({
          key: "library_layout",
          value: next,
          label: "Disposition de la bibliothèque",
          category: "general",
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-settings", "library_layout"] });
    },
  });

  return { layout: layout as LibraryLayout, isLoading, setLayout };
}

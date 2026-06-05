import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePublicationsRealtime(enabled = true) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;

    const invalidateCatalogue = () => {
      queryClient.invalidateQueries({ queryKey: ["publications"] });
      queryClient.invalidateQueries({ queryKey: ["publication"] });
      queryClient.invalidateQueries({ queryKey: ["admin-publications"] });
      queryClient.invalidateQueries({ queryKey: ["featured-publications"] });
      queryClient.invalidateQueries({ queryKey: ["author-publications"] });
      queryClient.invalidateQueries({ queryKey: ["similar-publications"] });
      queryClient.invalidateQueries({ queryKey: ["recommendations"] });
      queryClient.invalidateQueries({ queryKey: ["recent-certificates"] });
    };

    const channel = supabase
      .channel("publications-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publications" },
        () => {
          invalidateCatalogue();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
import { useEffect, useState } from "react";
import { useParams, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { supabase } from "@/integrations/supabase/client";

/**
 * Résout une URL du type /publication/KMG-ART-2026-001 en redirection vers /publication/:uuid
 */
export default function PublicationByNumber() {
  const { number } = useParams<{ number: string }>();
  const [resolvedId, setResolvedId] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!number) return;
      const { data } = await supabase
        .from("publications")
        .select("id")
        .eq("publication_number", number)
        .maybeSingle();
      if (!cancelled) setResolvedId(data?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [number]);

  if (resolvedId === undefined) {
    return (
      <Layout>
        <div className="container py-20 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </Layout>
    );
  }

  if (resolvedId === null) {
    // Pas trouvé → essai sur la page de vérification (peut être un n° de certificat)
    return <Navigate to={`/verify/${number}`} replace />;
  }

  return <Navigate to={`/publication/${resolvedId}`} replace />;
}

import { useFeaturedPublications } from "@/hooks/useFeaturedPublications";
import { FeaturedCarousel } from "@/components/home/FeaturedCarousel";
import { Eye, Sparkles, Info } from "lucide-react";

/**
 * Admin-only preview of the homepage "À la une" carousel.
 * Shows exactly what visitors will see — without registering clicks.
 */
export function FeaturedCarouselPreview() {
  const { data: publications, isLoading } = useFeaturedPublications(8);

  const adminFeaturedCount = publications?.filter((p) => (p as any).is_featured).length ?? 0;
  const mode =
    adminFeaturedCount > 0
      ? `Sélection manuelle (${adminFeaturedCount} publication${adminFeaturedCount > 1 ? "s" : ""})`
      : "Mode automatique : sélection par popularité (vues + téléchargements + nouveautés)";

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Eye className="h-4 w-4" />
          </div>
          <div>
            <h3 className="font-serif font-semibold text-foreground flex items-center gap-2">
              Aperçu du carrousel public
              <Sparkles className="h-3.5 w-3.5 text-yellow-500" />
            </h3>
            <p className="text-xs text-muted-foreground">
              Voici ce que les visiteurs voient sur la page d'accueil
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-background border border-border rounded-lg px-3 py-2 max-w-md">
          <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{isLoading ? "Calcul en cours…" : mode}</span>
        </div>
      </div>
      <div className="bg-background">
        <FeaturedCarousel preview />
      </div>
    </div>
  );
}

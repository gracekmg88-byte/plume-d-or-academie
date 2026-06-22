import { Heart, BookOpen } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useFavorites } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/publications/FavoriteButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { getCurrentHistoryEntryKey, saveScrollPosition } from "@/lib/scroll-restoration";
import { ensureNavigationReady } from "@/lib/route-preload";
import { preloadImage } from "@/components/ui/cached-image";
import { fetchPublication } from "@/hooks/usePublications";

export function FavoritesSection() {
  const { favorites, isLoading } = useFavorites();
  const { language } = useLanguage();
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const saveScroll = () => {
    saveScrollPosition(getCurrentHistoryEntryKey(), `${pathname}${search}`, window.scrollY);
  };

  const openPublication = async (
    event: React.MouseEvent<HTMLAnchorElement>,
    pub: { id: string; cover_image_url?: string | null },
  ) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    const entryKey = getCurrentHistoryEntryKey();
    const target = `/publication/${pub.id}`;
    saveScrollPosition(entryKey, `${pathname}${search}`, window.scrollY);
    await Promise.allSettled([
      ensureNavigationReady(target),
      pub.cover_image_url ? preloadImage(pub.cover_image_url) : Promise.resolve(),
      queryClient.ensureQueryData({
        queryKey: ["publication", pub.id],
        queryFn: () => fetchPublication(pub.id),
        staleTime: 60_000,
      }),
    ]);
    navigate(target, {
      state: {
        returnTo: `${pathname}${search}`,
        returnKey: entryKey,
        returnPublicationId: pub.id,
      },
    });
  };

  if (isLoading) {
    return (
      <div className="border-t border-border pt-6">
        <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
          <Heart className="h-4 w-4 text-red-500" />
          {language === "fr" ? "Mes favoris" : "My Favorites"}
        </h3>
        <div className="animate-pulse space-y-2">
          <div className="h-12 bg-muted rounded-lg" />
          <div className="h-12 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-border pt-6">
      <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
        <Heart className="h-4 w-4 text-red-500" />
        {language === "fr" ? "Mes favoris" : "My Favorites"}
        {favorites.length > 0 && (
          <span className="text-xs text-muted-foreground font-normal">
            ({favorites.length})
          </span>
        )}
      </h3>

      {favorites.length === 0 ? (
        <div className="text-center py-6">
          <BookOpen className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">
            {language === "fr"
              ? "Aucun favori. Ajoutez des publications à vos favoris !"
              : "No favorites yet. Add publications to your favorites!"}
          </p>
          <Link
            to="/bibliotheque"
            className="text-sm text-primary hover:underline mt-2 inline-block"
          >
            {language === "fr" ? "Parcourir la bibliothèque →" : "Browse the library →"}
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {favorites.map((fav) => {
            const pub = (fav as any).publications;
            if (!pub) return null;
            return (
              <div
                key={fav.id}
                className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5"
              >
                <Link
                  to={`/publication/${pub.id}`}
                  state={{
                    returnTo: `${pathname}${search}`,
                    returnKey: getCurrentHistoryEntryKey(),
                    returnPublicationId: pub.id,
                  }}
                  data-publication-card-id={pub.id}
                  onMouseEnter={saveScroll}
                  onClick={(event) => openPublication(event, pub)}
                  className="min-w-0 flex-1 mr-3 hover:text-primary transition-colors"
                >
                  <p className="text-sm font-medium text-foreground truncate">
                    {pub.title}
                  </p>
                  <p className="text-xs text-muted-foreground">{pub.author}</p>
                </Link>
                <FavoriteButton publicationId={pub.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

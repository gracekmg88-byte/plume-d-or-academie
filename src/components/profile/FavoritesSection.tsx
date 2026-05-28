import { Heart, BookOpen } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useFavorites } from "@/hooks/useFavorites";
import { FavoriteButton } from "@/components/publications/FavoriteButton";
import { useLanguage } from "@/contexts/LanguageContext";
import { saveScrollPosition } from "@/lib/scroll-restoration";

export function FavoritesSection() {
  const { favorites, isLoading } = useFavorites();
  const { language } = useLanguage();
  const { pathname } = useLocation();

  const saveScroll = () => {
    saveScrollPosition(window.history.state?.key, pathname, window.scrollY);
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
                  onClickCapture={saveScroll}
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

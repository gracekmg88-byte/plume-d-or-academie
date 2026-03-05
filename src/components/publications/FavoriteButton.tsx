import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useFavoriteIds, useToggleFavorite } from "@/hooks/useFavorites";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface FavoriteButtonProps {
  publicationId: string;
  className?: string;
  size?: "sm" | "icon";
}

export function FavoriteButton({ publicationId, className, size = "icon" }: FavoriteButtonProps) {
  const { user } = useAuth();
  const { favoriteIds } = useFavoriteIds();
  const toggleFavorite = useToggleFavorite();

  if (!user) return null;

  const isFavorited = favoriteIds.includes(publicationId);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggleFavorite.mutate(
      { publicationId, isFavorited },
      {
        onSuccess: () => {
          toast.success(isFavorited ? "Retiré des favoris" : "Ajouté aux favoris");
        },
      }
    );
  };

  return (
    <Button
      variant="ghost"
      size={size}
      className={cn(
        "transition-all",
        isFavorited
          ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
          : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10",
        className
      )}
      onClick={handleClick}
      disabled={toggleFavorite.isPending}
    >
      <Heart
        className={cn("h-4 w-4", isFavorited && "fill-current")}
      />
    </Button>
  );
}

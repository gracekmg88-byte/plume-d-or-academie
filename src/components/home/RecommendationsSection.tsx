import { Sparkles } from "lucide-react";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { useRecommendations } from "@/hooks/useRecommendations";

export function RecommendationsSection() {
  const { data: recommendations, isLoading } = useRecommendations(5);

  if (isLoading) {
    return (
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
              📚 Recommandé pour vous
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-background overflow-hidden">
      <div className="container">
        <div className="flex items-center gap-3 mb-8">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
            📚 Recommandé pour vous
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
          {recommendations.map((pub) => (
            <div key={pub.id}>
              <PublicationCard
                id={pub.id}
                title={pub.title}
                author={pub.author}
                category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                coverImageUrl={pub.cover_image_url || undefined}
                viewsCount={pub.views_count}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

import { useSimilarPublications } from "@/hooks/useSimilarPublications";
import { PublicationCard } from "@/components/publications/PublicationCard";

interface SimilarBooksProps {
  id: string;
  category: string;
  author: string;
  title?: string;
}

export function SimilarBooks({ id, category, author, title = "Livres similaires" }: SimilarBooksProps) {
  const { data, isLoading } = useSimilarPublications(id, category, author, 6);

  if (isLoading) return null;
  if (!data || data.length === 0) return null;

  return (
    <section className="mt-12 border-t border-border pt-8" aria-labelledby="similar-books-heading">
      <h2 id="similar-books-heading" className="font-serif text-2xl font-semibold text-foreground mb-6">
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
        {data.map((p) => (
          <PublicationCard
            key={p.id}
            id={p.id}
            title={p.title}
            author={p.author}
            category={p.category as any}
            coverImageUrl={p.cover_image_url || undefined}
            viewsCount={p.views_count || 0}
            variant="compact"
          />
        ))}
      </div>
    </section>
  );
}

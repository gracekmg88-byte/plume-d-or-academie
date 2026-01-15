import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { BookOpen } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { CategoryFilter } from "@/components/publications/CategoryFilter";
import { SearchBar } from "@/components/publications/SearchBar";
import { usePublications } from "@/hooks/usePublications";

type Category = "all" | "livre" | "memoire" | "tfc" | "article";

export default function Bibliotheque() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialCategory = (searchParams.get("categorie") as Category) || "all";
  
  const [category, setCategory] = useState<Category>(initialCategory);
  const [search, setSearch] = useState("");

  const { data: publications, isLoading } = usePublications(category === "all" ? undefined : category);

  const filteredPublications = useMemo(() => {
    if (!publications) return [];
    if (!search.trim()) return publications;
    
    const searchLower = search.toLowerCase();
    return publications.filter(
      (pub) =>
        pub.title.toLowerCase().includes(searchLower) ||
        pub.author.toLowerCase().includes(searchLower)
    );
  }, [publications, search]);

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory);
    if (newCategory === "all") {
      searchParams.delete("categorie");
    } else {
      searchParams.set("categorie", newCategory);
    }
    setSearchParams(searchParams);
  };

  return (
    <Layout>
      {/* Header */}
      <section className="bg-secondary py-12 md:py-16">
        <div className="container">
          <div className="max-w-2xl animate-slide-up">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground mb-4">
              Bibliothèque
            </h1>
            <p className="text-secondary-foreground/80 text-lg leading-relaxed">
              Explorez notre collection de livres, mémoires, TFC et articles académiques.
            </p>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="py-8 bg-card border-b border-border sticky top-16 md:top-20 z-40">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <CategoryFilter selected={category} onChange={handleCategoryChange} />
            <SearchBar value={search} onChange={setSearch} />
          </div>
        </div>
      </section>

      {/* Publications Grid */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container">
          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : filteredPublications.length > 0 ? (
            <>
              <p className="text-muted-foreground mb-6">
                {filteredPublications.length} publication{filteredPublications.length > 1 ? "s" : ""} trouvée{filteredPublications.length > 1 ? "s" : ""}
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredPublications.map((pub) => (
                  <PublicationCard
                    key={pub.id}
                    id={pub.id}
                    title={pub.title}
                    author={pub.author}
                    description={pub.description || undefined}
                    category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                    coverImageUrl={pub.cover_image_url || undefined}
                    viewsCount={pub.views_count}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-16">
              <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
                Aucune publication trouvée
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {search
                  ? `Aucun résultat pour "${search}". Essayez avec d'autres termes.`
                  : "Aucune publication disponible dans cette catégorie."}
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

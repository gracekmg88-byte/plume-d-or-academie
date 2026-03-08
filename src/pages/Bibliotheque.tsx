import { useState, useMemo, useEffect } from "react";

import { useSearchParams, useNavigate } from "react-router-dom";
import { BookOpen, WifiOff, RefreshCw, FolderDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Layout } from "@/components/layout/Layout";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { CategoryFilter } from "@/components/publications/CategoryFilter";
import { SearchBar } from "@/components/publications/SearchBar";
import { AdvancedFilters, type SortOption, type AdvancedFilterValues } from "@/components/publications/AdvancedFilters";
import { usePublications } from "@/hooks/usePublications";
import { preloadImages } from "@/components/ui/cached-image";
import { preloadAndCacheImages } from "@/lib/image-cache";
import { useOnlineStatus } from "@/hooks/useOffline";
import { getAllOfflinePublications, type OfflinePublication } from "@/lib/offline-storage";
import { useLanguage } from "@/contexts/LanguageContext";
import heroBiblioImage from "@/assets/hero-bibliotheque.webp";

type Category = "all" | "livre" | "memoire" | "tfc" | "article";

export default function Bibliotheque() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialCategory = (searchParams.get("categorie") as Category) || "all";
  
  const [category, setCategory] = useState<Category>(initialCategory);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<AdvancedFilterValues>({ author: "", sortBy: "date_desc" });
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();
  

  const { data: publications, isLoading } = usePublications(category === "all" ? undefined : category);

  // Offline cached publications
  const [offlinePubs, setOfflinePubs] = useState<OfflinePublication[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(!isOnline);

  useEffect(() => {
    if (!isOnline) {
      getAllOfflinePublications().then((pubs) => {
        setOfflinePubs(pubs);
        setOfflineLoading(false);
      });
    }
  }, [isOnline]);

  useEffect(() => {
    if (publications) {
      const urls = publications.map((p) => p.cover_image_url).filter((url): url is string => !!url);
      preloadImages(urls);
      preloadAndCacheImages(urls);
    }
  }, [publications]);

  const sourceData = isOnline ? publications : offlinePubs;
  const actualLoading = isOnline ? isLoading : offlineLoading;

  // Extract unique authors for filter dropdown
  const authors = useMemo(() => {
    const data = sourceData as Array<{ author: string }> | undefined;
    if (!data) return [];
    return [...new Set(data.map((p) => p.author))].sort();
  }, [sourceData]);

  const filteredPublications = useMemo(() => {
    const data = sourceData as Array<{ id: string; title: string; author: string; description: string | null; category: string; cover_image_url: string | null; views_count: number; created_at?: string }>;
    if (!data) return [];
    let filtered = [...data];
    if (!isOnline && category !== "all") {
      filtered = filtered.filter((p) => p.category === category);
    }
    if (search.trim()) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(
        (pub) => pub.title.toLowerCase().includes(searchLower) || pub.author.toLowerCase().includes(searchLower)
      );
    }
    // Author filter
    if (filters.author) {
      filtered = filtered.filter((p) => p.author === filters.author);
    }
    // Sorting
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case "date_asc":
          return (a.created_at || "").localeCompare(b.created_at || "");
        case "views_desc":
          return b.views_count - a.views_count;
        case "views_asc":
          return a.views_count - b.views_count;
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        case "date_desc":
        default:
          return (b.created_at || "").localeCompare(a.created_at || "");
      }
    });
    return filtered;
  }, [sourceData, search, category, isOnline, filters]);

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
      {/* Header with background image */}
      <section className="relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0">
          <img src={heroBiblioImage} alt="" className="h-full w-full object-cover" loading="eager" fetchPriority="high" decoding="sync" />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/85 to-secondary/70" />
        </div>
        <div className="relative container">
          <div className="max-w-2xl animate-slide-up">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground mb-4">
              {t("library.title")}
            </h1>
            <p className="text-secondary-foreground/80 text-lg leading-relaxed">
              {t("library.description")}
            </p>
          </div>
        </div>
      </section>

      {/* Offline banner */}
      {!isOnline && (
        <div className="container mt-4">
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-2 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t("library.offline")}</span>
          </div>
        </div>
      )}

      {/* Filters */}
      <section className="py-8 bg-card border-b border-border sticky top-16 md:top-20 z-40">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <CategoryFilter selected={category} onChange={handleCategoryChange} />
            <SearchBar value={search} onChange={setSearch} />
          </div>
          <div className="mt-3">
            <AdvancedFilters values={filters} onChange={setFilters} authors={authors} />
          </div>
        </div>
      </section>

      {/* Publications Grid */}
      <section className="py-12 md:py-16 bg-background">
        <div className="container">
          {actualLoading ? (
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
                {filteredPublications.length} {filteredPublications.length > 1 ? t("library.found_many") : t("library.found_one")}
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
                {t("library.noResults")}
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto">
                {!isOnline
                  ? t("library.noResultsOffline")
                  : search
                    ? t("library.noResultsSearch", { search })
                    : t("library.noResultsCategory")}
              </p>
            </div>
          )}
        </div>
      </section>
    </Layout>
  );
}

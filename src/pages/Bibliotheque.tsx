import { useState, useMemo, useEffect, useCallback, useRef } from "react";



import { useSearchParams, useNavigate, useLocation } from "react-router-dom";
import { BookOpen, WifiOff, RefreshCw, FolderDown, ChevronLeft, ChevronRight } from "lucide-react";

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
import { useLibraryLayout } from "@/hooks/useLibraryLayout";
import { SEO } from "@/components/seo/SEO";
import heroBiblioImage from "@/assets/hero-bibliotheque.webp";

type Category = "all" | "livre" | "memoire" | "tfc" | "article";

export default function Bibliotheque() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const initialCategory = (searchParams.get("categorie") as Category) || "all";
  const initialPage = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const initialSearch = searchParams.get("q") || "";
  const initialAuthor = searchParams.get("auteur") || "";
  const initialSort = (searchParams.get("tri") as SortOption) || "date_desc";

  const [category, setCategory] = useState<Category>(initialCategory);
  const [search, setSearch] = useState(initialSearch);
  const [filters, setFilters] = useState<AdvancedFilterValues>({ author: initialAuthor, sortBy: initialSort });
  const [currentPage, setCurrentPage] = useState(initialPage);
  const ITEMS_PER_PAGE = 12;
  const isOnline = useOnlineStatus();
  const { t } = useLanguage();
  const { layout } = useLibraryLayout();
  
  

  const { data: publications, isLoading } = usePublications(category === "all" ? undefined : category);

  // Offline cached publications
  const [offlinePubs, setOfflinePubs] = useState<OfflinePublication[]>([]);
  const [offlineLoading, setOfflineLoading] = useState(!isOnline);
  const restoredCardRef = useRef<string | null>(null);
  const restorationAttemptRef = useRef(0);
  const hasConsumedRestoreStateRef = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      getAllOfflinePublications().then((pubs) => {
        setOfflinePubs(pubs);
        setOfflineLoading(false);
      });
    }
  }, [isOnline]);

  useEffect(() => {
    if (publications?.length) {
      const urls = publications
        .slice(0, 16)
        .map((p) => p.cover_image_url)
        .filter((url): url is string => !!url);
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
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      switch (filters.sortBy) {
        case "date_asc":
          return dateA - dateB;
        case "date_desc":
          return dateB - dateA;
        case "views_desc":
          return (b.views_count ?? 0) - (a.views_count ?? 0);
        case "views_asc":
          return (a.views_count ?? 0) - (b.views_count ?? 0);
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "title_desc":
          return b.title.localeCompare(a.title);
        default:
          return dateB - dateA;
      }
    });
    return filtered;
  }, [sourceData, search, category, isOnline, filters]);

  // Reset page when filters change — but skip the very first render so that
  // returning from a publication (e.g. ?page=5) keeps the saved page instead of resetting to 1.
  const skipResetRef = useRef(true);
  useEffect(() => {
    if (skipResetRef.current) {
      skipResetRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [search, category, filters]);

  // Sync filters/search/sort to URL so that returning here via back restores exact state.
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const set = (key: string, value: string | null) => {
      if (value && value.length > 0) next.set(key, value);
      else next.delete(key);
    };
    set("categorie", category === "all" ? null : category);
    set("q", search.trim() || null);
    set("auteur", filters.author || null);
    set("tri", filters.sortBy && filters.sortBy !== "date_desc" ? filters.sortBy : null);
    set("page", currentPage > 1 ? String(currentPage) : null);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [category, search, filters, currentPage, searchParams, setSearchParams]);

  const totalPages = Math.ceil(filteredPublications.length / ITEMS_PER_PAGE);
  const paginatedPublications = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredPublications.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredPublications, currentPage, ITEMS_PER_PAGE]);

  const handleCategoryChange = (newCategory: Category) => {
    setCategory(newCategory);
    setCurrentPage(1);
    const nextParams = new URLSearchParams(searchParams);
    if (newCategory === "all") {
      nextParams.delete("categorie");
    } else {
      nextParams.set("categorie", newCategory);
    }
    nextParams.delete("page");
    setSearchParams(nextParams, { replace: true });
  };

  const scrollToGrid = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    const nextParams = new URLSearchParams(searchParams);
    if (page <= 1) {
      nextParams.delete("page");
    } else {
      nextParams.set("page", String(page));
    }
    setSearchParams(nextParams, { replace: true });
    scrollToGrid();
  }, [scrollToGrid, searchParams, setSearchParams]);

  useEffect(() => {
    const navState = location.state as { restoredFromPublication?: boolean; returnPublicationId?: string | null } | null;
    const targetPublicationId = navState?.restoredFromPublication ? navState.returnPublicationId : null;

    if (!targetPublicationId || actualLoading || restoredCardRef.current === targetPublicationId || hasConsumedRestoreStateRef.current) {
      return;
    }

    const restoreCard = () => {
      const card = document.querySelector<HTMLElement>(`[data-publication-card-id="${targetPublicationId}"]`);
      if (!card) return false;

      const cardTop = card.getBoundingClientRect().top + window.scrollY;
      const stickyOffset = window.innerWidth >= 768 ? 112 : 96;
      const targetTop = Math.max(0, cardTop - stickyOffset - 12);

      window.scrollTo({ top: targetTop, left: 0, behavior: "instant" as ScrollBehavior });
      restoredCardRef.current = targetPublicationId;
      hasConsumedRestoreStateRef.current = true;

      if (window.history.state?.usr?.restoredFromPublication) {
        window.history.replaceState(
          {
            ...window.history.state,
            usr: {
              ...window.history.state.usr,
              restoredFromPublication: false,
            },
          },
          "",
          window.location.href,
        );
      }
      return true;
    };

    let raf = 0;
    let cancelled = false;
    restorationAttemptRef.current = 0;

    const attemptRestore = () => {
      if (cancelled) return;
      if (restoreCard()) return;

      restorationAttemptRef.current += 1;
      if (restorationAttemptRef.current < 24) {
        raf = window.requestAnimationFrame(attemptRestore);
      }
    };

    raf = window.requestAnimationFrame(attemptRestore);

    return () => {
      cancelled = true;
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [actualLoading, location.state, paginatedPublications]);

  useEffect(() => {
    const navState = location.state as { restoredFromPublication?: boolean } | null;
    if (navState?.restoredFromPublication) return;

    restoredCardRef.current = null;
    restorationAttemptRef.current = 0;
  }, [location.key, location.state]);

  useEffect(() => {
    const navState = location.state as { restoredFromPublication?: boolean } | null;
    if (!navState?.restoredFromPublication) {
      hasConsumedRestoreStateRef.current = false;
    }
  }, [location.key, location.state]);

  return (
    <Layout>
      <SEO
        title="Bibliothèque — livres, mémoires, TFC et articles"
        description="Catalogue académique complet : livres, mémoires, TFC et articles scientifiques avec filtres, recherche et tri. Lecture gratuite, en ligne et hors-ligne."
        path="/bibliotheque"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "CollectionPage",
          name: "Bibliothèque KMG Bibliothèque",
          url: "https://plume-d-or-academie.lovable.app/bibliotheque",
          description: "Catalogue de publications académiques francophones.",
          isPartOf: { "@type": "WebSite", name: "KMG Bibliothèque" },
        }}
      />
      {/* Header with background image */}
      <section className="relative overflow-hidden py-12 md:py-16">
        <div className="absolute inset-0">
          <img src={heroBiblioImage} alt="" className="h-full w-full object-cover" loading="eager" decoding="sync" />
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

      {/* No connection state */}
      {!isOnline && !actualLoading && filteredPublications.length === 0 && offlinePubs.length === 0 ? (
        <section className="relative py-12 md:py-16 overflow-hidden">
          <div className="absolute inset-0">
            <img src={heroBiblioImage} alt="" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-background/90 dark:bg-background/95 backdrop-blur-sm" />
          </div>
          <div className="relative container">
            <div className="text-center py-16 max-w-md mx-auto">
              <WifiOff className="h-16 w-16 mx-auto mb-4 text-destructive/50" />
              <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
                ⚠️ {t("library.noConnection")}
              </h2>
              <p className="text-muted-foreground mb-2">
                {t("library.noConnectionDesc")}
              </p>
              <p className="text-muted-foreground text-sm mb-6">
                {t("library.noConnectionHint")}
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button onClick={() => window.location.reload()} variant="default">
                  <RefreshCw className="h-4 w-4" />
                  {t("library.retry")}
                </Button>
                <Button onClick={() => navigate("/profil")} variant="outline">
                  <FolderDown className="h-4 w-4" />
                  {t("library.viewOfflineDocs")}
                </Button>
              </div>
            </div>
          </div>
        </section>
      ) : (
        /* Publications Grid */
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
                  {totalPages > 1 && (
                    <span className="ml-2 text-sm">
                      — Page {currentPage}/{totalPages}
                    </span>
                  )}
                </p>
                {layout === "list" ? (
                  <div className="flex flex-col gap-4">
                    {paginatedPublications.map((pub) => (
                      <PublicationCard
                        key={pub.id}
                        id={pub.id}
                        title={pub.title}
                        author={pub.author}
                        description={pub.description || undefined}
                        category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                        coverImageUrl={pub.cover_image_url || undefined}
                        viewsCount={pub.views_count}
                        variant="list"
                      />
                    ))}
                  </div>
                ) : layout === "magazine" ? (
                  <div className="space-y-6">
                    {paginatedPublications[0] && (
                      <PublicationCard
                        key={paginatedPublications[0].id}
                        id={paginatedPublications[0].id}
                        title={paginatedPublications[0].title}
                        author={paginatedPublications[0].author}
                        description={paginatedPublications[0].description || undefined}
                        category={paginatedPublications[0].category as "livre" | "memoire" | "tfc" | "article"}
                        coverImageUrl={paginatedPublications[0].cover_image_url || undefined}
                        viewsCount={paginatedPublications[0].views_count}
                        variant="magazine-hero"
                      />
                    )}
                    {paginatedPublications.length > 1 && (
                      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {paginatedPublications.slice(1).map((pub) => (
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
                    )}
                  </div>
                ) : layout === "compact" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {paginatedPublications.map((pub) => (
                      <PublicationCard
                        key={pub.id}
                        id={pub.id}
                        title={pub.title}
                        author={pub.author}
                        category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                        coverImageUrl={pub.cover_image_url || undefined}
                        viewsCount={pub.views_count}
                        variant="compact"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {paginatedPublications.map((pub) => (
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
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 mt-10">
                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === 1}
                      onClick={() => handlePageChange(currentPage - 1)}
                      aria-label="Page précédente"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                        if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                          acc.push("ellipsis");
                        }
                        acc.push(page);
                        return acc;
                      }, [])
                      .map((item, idx) =>
                        item === "ellipsis" ? (
                          <span key={`e-${idx}`} className="px-2 text-muted-foreground">…</span>
                        ) : (
                          <Button
                            key={item}
                            variant={currentPage === item ? "default" : "outline"}
                            size="icon"
                            className="h-9 w-9"
                            onClick={() => handlePageChange(item)}
                          >
                            {item}
                          </Button>
                        )
                      )}

                    <Button
                      variant="outline"
                      size="icon"
                      disabled={currentPage === totalPages}
                      onClick={() => handlePageChange(currentPage + 1)}
                      aria-label="Page suivante"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16">
                <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground/30" />
                <h2 className="font-serif text-2xl font-semibold text-foreground mb-2">
                  {t("library.noResults")}
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  {search
                    ? t("library.noResultsSearch", { search })
                    : t("library.noResultsCategory")}
                </p>
              </div>
            )}
          </div>
        </section>
      )}
      
    </Layout>
  );
}

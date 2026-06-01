import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import useEmblaCarousel from "embla-carousel-react";

import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Sparkles, Eye, Download, AlertCircle, RefreshCw } from "lucide-react";
import { useFeaturedPublications, type FeaturedPublication } from "@/hooks/useFeaturedPublications";
import { CachedImage, preloadImages } from "@/components/ui/cached-image";
import { Button } from "@/components/ui/button";
import { saveScrollPosition } from "@/lib/scroll-restoration";
import { preloadPublicationFlow } from "@/lib/route-preload";
import { fetchPublication } from "@/hooks/usePublications";

const categoryLabel: Record<string, string> = {
  livre: "Livre",
  memoire: "Mémoire",
  tfc: "TFC",
  article: "Article",
};

interface FeaturedCarouselProps {
  /** When true, links are disabled (preview mode in admin). */
  preview?: boolean;
  /** Optional override of publications (used by admin preview). */
  publications?: FeaturedPublication[];
}

function CarouselSkeleton() {
  return (
    <div className="flex gap-4 -mx-2 px-2 overflow-hidden">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex-shrink-0 w-[70%] sm:w-[45%] md:w-[32%] lg:w-[24%]"
        >
          <div className="rounded-xl overflow-hidden bg-card border border-border">
            <div className="aspect-[3/4] bg-gradient-to-br from-muted via-muted/60 to-muted animate-pulse" />
            <div className="p-3 space-y-2">
              <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
              <div className="h-3 w-2/3 rounded bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CoverFallback({ title }: { title: string }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-secondary via-secondary/80 to-primary/30 p-4">
      <span className="font-serif text-sm text-secondary-foreground/90 text-center line-clamp-4">
        {title}
      </span>
    </div>
  );
}

function CarouselCard({
  pub,
  preview,
  onNavigate,
  highlighted,
}: {
  pub: FeaturedPublication;
  preview: boolean;
  onNavigate?: (id: string) => void;
  highlighted?: boolean;
}) {
  const [imgError, setImgError] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    if (preview) return;
    e.preventDefault();
    onNavigate?.(pub.id);
  };

  return (
    <a
      href={preview ? undefined : `/publication/${pub.id}`}
      onClick={handleClick}
      className={preview ? "cursor-default block" : "block"}
      draggable={false}
      data-publication-card-id={pub.id}
      data-highlighted={highlighted ? "true" : undefined}
    >

      <div
        className={`group block rounded-xl overflow-hidden bg-card border transition-all duration-300 h-full ${
          highlighted
            ? "border-primary ring-2 ring-primary/60 shadow-elegant animate-pulse-slow"
            : "border-border hover:border-primary/50 hover:shadow-elegant"
        }`}
      >
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {pub.cover_image_url && !imgError ? (
            <CachedImage
              src={pub.cover_image_url}
              alt={pub.title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              onError={() => setImgError(true)}
            />
          ) : (
            <CoverFallback title={pub.title} />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
          <div className="absolute top-2 left-2 flex gap-1.5">
            <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm">
              {categoryLabel[pub.category] || pub.category}
            </span>
            {(pub as any).is_featured && (
              <span className="px-1.5 py-0.5 text-[10px] rounded-full bg-yellow-500/90 text-black backdrop-blur-sm flex items-center gap-0.5">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            )}
          </div>
          <div className="absolute bottom-2 right-2 flex items-center gap-1.5">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-sm">
              <Eye className="h-3 w-3" />
              {pub.views_count}
            </span>
            {((pub as any).downloads_count ?? 0) > 0 && (
              <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-sm">
                <Download className="h-3 w-3" />
                {(pub as any).downloads_count}
              </span>
            )}
          </div>
        </div>
        <div className="p-3 space-y-1">
          <h3 className="font-serif text-sm md:text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
            {pub.title}
          </h3>
          <p className="text-xs text-muted-foreground line-clamp-1">{pub.author}</p>
        </div>
      </div>
    </a>
  );
}

const LAST_FEATURED_PICK_KEY = "carousel:lastFeaturedPickId";
const LAST_FEATURED_PICK_AT = "carousel:lastFeaturedPickAt";
const LAST_FEATURED_TTL_MS = 10 * 60 * 1000; // 10 min — survives slow networks


export function FeaturedCarousel({ preview = false, publications: override }: FeaturedCarouselProps = {}) {
  const query = useFeaturedPublications(8);
  const publications = override ?? query.data;
  const isLoading = override ? false : query.isLoading;
  const isError = override ? false : query.isError;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const autoplay = useRef(
    Autoplay({
      delay: 4000,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
      stopOnLastSnap: false,
playOnInit: true,
    })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: false, duration: 25 },
    [autoplay.current]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const handleNavigate = useCallback(
    (id: string) => {
      // Respect Embla drag/swipe — don't navigate if user was swiping
      const clickAllowed = (emblaApi as any)?.clickAllowed?.();
      if (emblaApi && clickAllowed === false) return;

      saveScrollPosition(window.history.state?.key, location.pathname, window.scrollY);
      try {
        sessionStorage.setItem(LAST_FEATURED_PICK_KEY, id);
        sessionStorage.setItem(LAST_FEATURED_PICK_AT, String(Date.now()));
      } catch {}
      preloadPublicationFlow();
      queryClient
        .prefetchQuery({
          queryKey: ["publication", id],
          queryFn: () => fetchPublication(id),
          staleTime: 60_000,
        })
        .catch(() => {});
      navigate(`/publication/${id}`, {
        state: {
          returnTo: `${location.pathname}${location.search}`,
          returnKey: window.history.state?.key ?? null,
          returnPublicationId: id,
        },
      });
    },
    [emblaApi, location.pathname, location.search, navigate, queryClient]
  );


  useEffect(() => {
    if (publications?.length) {
      const urls = publications
        .map((p) => p.cover_image_url)
        .filter((u): u is string => !!u);
      preloadImages(urls);
    }
  }, [publications]);

  // Compute the id we should restore to — either from router state or sessionStorage fallback.
  const restoreId = (() => {
    const navState = location.state as { restoredFromPublication?: boolean; returnPublicationId?: string | null } | null;
    if (navState?.restoredFromPublication && navState.returnPublicationId) {
      return navState.returnPublicationId;
    }
    try {
      const id = sessionStorage.getItem(LAST_FEATURED_PICK_KEY);
      const at = Number(sessionStorage.getItem(LAST_FEATURED_PICK_AT) || 0);
      if (id && Date.now() - at < LAST_FEATURED_TTL_MS) return id;
    } catch {}
    return null;
  })();

  // Robust restore: works as soon as publications data is available, even after slow network.
  useEffect(() => {
    if (!emblaApi || !publications?.length || !restoreId) return;
    const idx = publications.findIndex((p) => p.id === restoreId);
    if (idx < 0) return;

    emblaApi.scrollTo(idx, true);
    // Keep autoplay running — user wants the carousel to never pause.
    setHighlightedId(restoreId);

    // Bring the actual DOM card into view in case the page also needs to scroll.
    const bringIntoView = () => {
      const el = document.querySelector<HTMLElement>(`[data-publication-card-id="${restoreId}"]`);
      if (el) {
        const rect = el.getBoundingClientRect();
        const offscreen = rect.top < 80 || rect.bottom > window.innerHeight;
        if (offscreen) {
          el.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
        }
      }
    };
    const raf1 = requestAnimationFrame(() => {
      bringIntoView();
      const raf2 = requestAnimationFrame(bringIntoView);
      (bringIntoView as any).__raf = raf2;
    });

    const clearTO = window.setTimeout(() => setHighlightedId(null), 2800);
    const clearStorageTO = window.setTimeout(() => {
      try {
        sessionStorage.removeItem(LAST_FEATURED_PICK_KEY);
        sessionStorage.removeItem(LAST_FEATURED_PICK_AT);
      } catch {}
    }, 500);

    return () => {
      cancelAnimationFrame(raf1);
      window.clearTimeout(clearTO);
      window.clearTimeout(clearStorageTO);
    };
  }, [emblaApi, publications, restoreId]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, publications]);



  // Loading state
  if (isLoading) {
    return (
      <section className="py-8 md:py-12 bg-background">
        <div className="container">
          <div className="space-y-2 mb-6">
            <div className="h-5 w-24 rounded-full bg-muted animate-pulse" />
            <div className="h-8 w-64 rounded bg-muted animate-pulse" />
          </div>
          <CarouselSkeleton />
        </div>
      </section>
    );
  }

  // Error state
  if (isError) {
    return (
      <section className="py-8 md:py-12 bg-background">
        <div className="container">
          <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center max-w-md mx-auto">
            <AlertCircle className="h-8 w-8 mx-auto text-destructive mb-2" />
            <p className="text-sm text-foreground mb-3">
              Impossible de charger la sélection du moment
            </p>
            <Button size="sm" variant="outline" onClick={() => query.refetch()} className="gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Réessayer
            </Button>
          </div>
        </div>
      </section>
    );
  }

  if (!publications || publications.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-gradient-to-b from-background via-background to-card/30">
      <div className="container">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">
                {preview ? "Aperçu — À la une" : "À la une"}
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
              Sélection du moment
            </h2>
          </div>
          <div className="hidden md:flex gap-2">
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              aria-label="Précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              aria-label="Suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden -mx-2" ref={emblaRef}>
          <div className="flex">
            {publications.map((pub) => (
              <div
                key={pub.id}
                className="flex-[0_0_70%] sm:flex-[0_0_45%] md:flex-[0_0_32%] lg:flex-[0_0_24%] px-2"
              >
                <CarouselCard pub={pub} preview={preview} onNavigate={handleNavigate} highlighted={highlightedId === pub.id} />
              </div>
            ))}
          </div>
        </div>

        {scrollSnaps.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-6">
            {scrollSnaps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => emblaApi?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === selectedIndex
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Aller à la diapositive ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

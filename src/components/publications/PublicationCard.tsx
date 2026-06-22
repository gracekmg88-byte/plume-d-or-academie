import { useEffect, useRef, useCallback, useMemo, type MouseEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Book, FileText, GraduationCap, Newspaper, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CachedImage, preloadImage } from "@/components/ui/cached-image";
import { FavoriteButton } from "@/components/publications/FavoriteButton";
import { cn } from "@/lib/utils";
import { fetchPublication } from "@/hooks/usePublications";
import { getCurrentHistoryEntryKey, saveScrollPosition } from "@/lib/scroll-restoration";
import { ensureNavigationReady, preloadPublicationFlow } from "@/lib/route-preload";
import { buildPublicationPath } from "@/lib/slug";
import { cacheImage } from "@/lib/image-cache";
import { Capacitor } from "@capacitor/core";

type Category = "livre" | "memoire" | "tfc" | "article";
export type PublicationCardVariant = "grid" | "compact" | "list" | "magazine-hero";

interface PublicationCardProps {
  id: string;
  title: string;
  author: string;
  description?: string;
  category: Category;
  coverImageUrl?: string;
  viewsCount: number;
  variant?: PublicationCardVariant;
}

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-blue-500/10 text-blue-600" },
  tfc: { label: "TFC", icon: FileText, className: "bg-green-500/10 text-green-600" },
  article: { label: "Article", icon: Newspaper, className: "bg-purple-500/10 text-purple-600" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function PublicationCard({
  id,
  title,
  author,
  description,
  category,
  coverImageUrl,
  viewsCount,
  variant = "grid",
}: PublicationCardProps) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const config = categoryConfig[category];
  const Icon = config.icon;
  const rootRef = useRef<HTMLAnchorElement>(null);
  const prefetchedRef = useRef(false);

  const prefetchAll = useCallback(() => {
    if (prefetchedRef.current) return;
    prefetchedRef.current = true;
    preloadPublicationFlow();
    queryClient
      .prefetchQuery({
        queryKey: ["publication", id],
        queryFn: () => fetchPublication(id),
        staleTime: 60_000,
      })
      .catch(() => {});
    if (coverImageUrl) {
      if (Capacitor.isNativePlatform()) {
        cacheImage(coverImageUrl).catch(() => {});
      } else {
        preloadImage(coverImageUrl).catch(() => {});
      }
    }
  }, [coverImageUrl, id, queryClient]);

  const prepareNavigation = useCallback(() => {
    const entryKey = getCurrentHistoryEntryKey();
    saveScrollPosition(entryKey, `${pathname}${search}`, window.scrollY);
    prefetchAll();
  }, [pathname, prefetchAll, search]);

  const publicationPath = buildPublicationPath({ id, title, category });
  const linkState = useMemo(
    () => ({
      returnTo: `${pathname}${search}`,
      returnKey: getCurrentHistoryEntryKey(),
      returnPublicationId: UUID_RE.test(id) ? id : undefined,
    }),
    [id, pathname, search],
  );

  const handleNavigate = useCallback(async (event: MouseEvent<HTMLAnchorElement>) => {
    prepareNavigation();
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    event.preventDefault();

    const coverReady = coverImageUrl
      ? Capacitor.isNativePlatform()
        ? cacheImage(coverImageUrl)
        : preloadImage(coverImageUrl)
      : Promise.resolve();

    await Promise.allSettled([
      ensureNavigationReady(publicationPath),
      coverReady,
      queryClient.ensureQueryData({
        queryKey: ["publication", id],
        queryFn: () => fetchPublication(id),
        staleTime: 60_000,
      }),
    ]);

    navigate(publicationPath, { state: linkState });
  }, [coverImageUrl, id, linkState, navigate, prepareNavigation, publicationPath, queryClient]);

  // Prefetch metadata + warm thumbnail when card scrolls into view
  useEffect(() => {
    const el = rootRef.current;
    if (!el || prefetchedRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      prefetchAll();
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          prefetchAll();
          io.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [prefetchAll]);

  const linkProps = {
    ref: rootRef,
    to: publicationPath,
    state: linkState,
    "data-publication-card-id": id,
    onMouseEnter: prepareNavigation,
    onClick: handleNavigate,
    className: "self-start",
  } as const;

  // LIST variant — horizontal row with thumbnail + full description
  if (variant === "list") {
    return (
      <Link {...linkProps}>
        <Card className="group flex gap-4 p-3 sm:p-4 overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-0.5 bg-card border-border/50">
          <div className="relative w-24 sm:w-32 aspect-[3/4] shrink-0 overflow-hidden rounded-md bg-muted">
            {coverImageUrl ? (
              <CachedImage
                src={coverImageUrl}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                containerClassName="h-full w-full"
                fallbackIcon={<Icon className="h-10 w-10 text-muted-foreground/30" />}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                <Icon className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <Badge className={cn("gap-1", config.className)}>
                <Icon className="h-3 w-3" />
                {config.label}
              </Badge>
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                {viewsCount}
              </span>
            </div>
            <h3 className="font-serif text-base sm:text-lg font-semibold leading-tight break-words group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">{author}</p>
            {description && (
              <p className="mt-2 text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                {description}
              </p>
            )}
            <div className="mt-auto pt-2">
              <FavoriteButton publicationId={id} className="h-7 w-7" />
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  // MAGAZINE HERO — large featured card (wide image, big title)
  if (variant === "magazine-hero") {
    return (
      <Link {...linkProps}>
        <Card className="group overflow-hidden transition-all duration-300 hover:shadow-elegant bg-card border-border/50">
          <div className="grid md:grid-cols-2 gap-0">
            <div className="relative aspect-[16/10] min-h-[220px] md:aspect-auto md:min-h-[280px] overflow-hidden bg-muted">
              {coverImageUrl ? (
                <CachedImage
                  src={coverImageUrl}
                  alt={title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  containerClassName="h-full w-full"
                  fallbackIcon={<Icon className="h-16 w-16 text-muted-foreground/30" />}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                  <Icon className="h-20 w-20 text-muted-foreground/30" />
                </div>
              )}
              <Badge className={cn("absolute top-3 left-3 z-10", config.className)}>
                <Icon className="h-3 w-3 mr-1" />
                {config.label}
              </Badge>
              <div className="absolute top-3 right-3 z-10">
                <FavoriteButton
                  publicationId={id}
                  className="h-8 w-8 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background"
                />
              </div>
            </div>
            <CardContent className="p-5 md:p-6 flex flex-col justify-center">
              <span className="text-xs uppercase tracking-wider text-primary font-semibold mb-2">
                À découvrir
              </span>
              <h3 className="font-serif text-2xl md:text-3xl font-bold leading-tight break-words group-hover:text-primary transition-colors">
                {title}
              </h3>
              <p className="mt-2 text-base text-muted-foreground">{author}</p>
              {description && (
                <p className="mt-3 text-sm text-muted-foreground line-clamp-4 leading-relaxed">
                  {description}
                </p>
              )}
              <div className="mt-4 flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" />
                <span>{viewsCount} consultations</span>
              </div>
            </CardContent>
          </div>
        </Card>
      </Link>
    );
  }

  // COMPACT — smaller card, title only
  if (variant === "compact") {
    return (
      <Link {...linkProps}>
        <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 bg-card border-border/50">
          <div className="relative aspect-[3/4] overflow-hidden bg-muted">
            {coverImageUrl ? (
              <CachedImage
                src={coverImageUrl}
                alt={title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                containerClassName="h-full w-full"
                fallbackIcon={<Icon className="h-10 w-10 text-muted-foreground/30" />}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                <Icon className="h-10 w-10 text-muted-foreground/30" />
              </div>
            )}
            <Badge className={cn("absolute top-2 left-2 z-10 text-[10px] px-1.5 py-0", config.className)}>
              {config.label}
            </Badge>
          </div>
          <CardContent className="p-2.5 min-w-0">
            <h3 className="font-serif text-sm font-semibold leading-tight break-words group-hover:text-primary transition-colors">
              {title}
            </h3>
            <p className="mt-0.5 text-xs text-muted-foreground break-words">{author}</p>
          </CardContent>
        </Card>
      </Link>
    );
  }

  // Default GRID variant (existing behavior)
  return (
    <Link {...linkProps}>
      <Card className="group h-full overflow-hidden transition-all duration-300 hover:shadow-elegant hover:-translate-y-1 bg-card border-border/50">
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {coverImageUrl ? (
            <CachedImage
              src={coverImageUrl}
              alt={title}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              containerClassName="h-full w-full"
              fallbackIcon={<Icon className="h-16 w-16 text-muted-foreground/30" />}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
              <Icon className="h-16 w-16 text-muted-foreground/30" />
            </div>
          )}
          <Badge className={cn("absolute top-3 left-3 z-10", config.className)}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          <div className="absolute top-3 right-3 z-10">
            <FavoriteButton
              publicationId={id}
              className="h-8 w-8 bg-background/80 backdrop-blur-sm shadow-sm hover:bg-background"
            />
          </div>
        </div>

        <CardContent className="p-3 sm:p-4 min-w-0">
          <h3 className="font-serif text-base sm:text-lg font-semibold leading-tight break-words group-hover:text-primary transition-colors">
            {title}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-muted-foreground break-words">{author}</p>
          {description && (
            <p className="mt-2 hidden sm:line-clamp-2 sm:block text-sm text-muted-foreground leading-relaxed">
              {description}
            </p>
          )}
          <div className="mt-3 flex items-center gap-1 text-xs text-muted-foreground">
            <Eye className="h-3 w-3" />
            <span>{viewsCount}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

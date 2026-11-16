import { useEffect, useCallback, useState, useMemo, useRef, useLayoutEffect } from "react";
import { useParams, Link, useSearchParams, useLocation, useNavigate, Navigate } from "react-router-dom";
import { ArrowLeft, Book, FileText, GraduationCap, Newspaper, Eye, Calendar, User, Lock, Download, WifiOff, CheckCircle, Heart } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CachedImage } from "@/components/ui/cached-image";
import { ProtectedPdfViewer } from "@/components/publications/ProtectedPdfViewer";
import { AnnotationsPanel } from "@/components/publications/AnnotationsPanel";
import { AISummary } from "@/components/publications/AISummary";
import { usePublication, useIncrementViews, useIncrementDownloads } from "@/hooks/usePublications";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { useDownloadSetting } from "@/hooks/useDownloadSetting";
import { useOnlineStatus } from "@/hooks/useOffline";
import { useLanguage } from "@/contexts/LanguageContext";
import { savePublicationOffline, getOfflinePublication, isPublicationCached, type OfflinePublication } from "@/lib/offline-storage";
import { useTrackReading } from "@/hooks/useReadingHistory";
import { supabase } from "@/integrations/supabase/client";
import { FavoriteButton } from "@/components/publications/FavoriteButton";
import { ShareButtons } from "@/components/publications/ShareButtons";
import { cn } from "@/lib/utils";
import { CommentsList } from "@/components/publications/CommentsList";
import { CertificationSection } from "@/components/publications/CertificationSection";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { SEO } from "@/components/seo/SEO";
import { publicationSeo, type SeoPublication } from "@/seo/pageSeo";
import { useReadingUrl, ReadingAccessError, usePremiumEnforced } from "@/hooks/usePremium";
import { Breadcrumb } from "@/components/publications/Breadcrumb";
import { SimilarBooks } from "@/components/publications/SimilarBooks";
import { buildPublicationPath, buildAuthorPath, parseSlugSuffix, categoryPath } from "@/lib/slug";
import { ensureNavigationReady, prefetchRoute } from "@/lib/route-preload";
import { preloadPdfEngine } from "@/lib/pdf-engine";

type Category = "livre" | "memoire" | "tfc" | "article";

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-secondary/80 text-secondary-foreground" },
  tfc: { label: "TFC", icon: FileText, className: "bg-accent text-accent-foreground" },
  article: { label: "Article", icon: Newspaper, className: "bg-muted text-muted-foreground" },
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function Publication() {
  const { id: rawId, slug } = useParams<{ id: string; slug: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const pageFromUrl = parseInt(searchParams.get("page") || "0", 10);
  const isOnline = useOnlineStatus();
  const returnState = location.state as {
    returnTo?: string;
    returnKey?: string | null;
    returnPublicationId?: string | null;
  } | null;
  const initialPublicationId = returnState?.returnPublicationId && UUID_RE.test(returnState.returnPublicationId)
    ? returnState.returnPublicationId
    : undefined;

  // Three URL shapes are supported:
  // 1) /publication/:id where :id is a UUID
  // 2) /publication/:id where :id is a publication_number (e.g. KMG-LIV-2026-001)
  // 3) /livre/:slug, /memoire/:slug, /tfc/:slug, /article/:slug — slug ends with 6-hex UUID prefix
  const isUuid = !!rawId && UUID_RE.test(rawId);
  const slugSuffix = parseSlugSuffix(slug);

  const [resolvedUuid, setResolvedUuid] = useState<string | null | undefined>(
    isUuid ? rawId : initialPublicationId,
  );
  // Échec réseau (≠ livre inexistant) : on l'affiche honnêtement avec « Réessayer ».
  const [resolveFailed, setResolveFailed] = useState(false);
  const [resolveAttempt, setResolveAttempt] = useState(0);

  // Commence à télécharger le moteur du lecteur PDF dès l'arrivée sur la fiche du livre.
  useEffect(() => { preloadPdfEngine(); }, []);

  useEffect(() => {
    if (isUuid) {
      setResolvedUuid(rawId);
      return;
    }
    if (initialPublicationId) {
      setResolvedUuid(initialPublicationId);
      return;
    }
    // Reset to undefined so the skeleton stays visible while we resolve.
    setResolvedUuid(undefined);
    setResolveFailed(false);
    // Une recherche qui échoue (4G instable, appli réveillée, session à renouveler) n'est PAS un
    // livre introuvable : jusqu'à 3 essais espacés, puis message « problème de connexion ».
    const withRetry = async <T,>(run: () => PromiseLike<{ data: T | null; error: unknown }>, isCancelled: () => boolean) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { data, error } = await run();
        if (!error) return { data, failed: false };
        if (isCancelled()) break;
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
      return { data: null, failed: true };
    };
    // Slug → resolve UUID by id prefix
    if (slugSuffix) {
      let cancelled = false;
      (async () => {
        const lo = `${slugSuffix}00-0000-0000-0000-000000000000`;
        const hi = `${slugSuffix}ff-ffff-ffff-ffff-ffffffffffff`;
        const { data, failed } = await withRetry<{ id: string }>(() => supabase
          .from("publications")
          .select("id")
          .gte("id", lo)
          .lte("id", hi)
          .eq("is_published", true)
          .limit(1)
          .maybeSingle(), () => cancelled);
        if (cancelled) return;
        setResolveFailed(failed);
        setResolvedUuid(data?.id ?? null);
      })();
      return () => { cancelled = true; };
    }
    // publication_number → resolve UUID
    if (!rawId) return;
    let cancelled = false;
    (async () => {
      const code = rawId.toUpperCase();
      const { data } = await supabase
        .from("publications")
        .select("id")
        .eq("publication_number", code)
        .maybeSingle();
      let resolved = data?.id ?? null;
      // Repli pour les QR codes des certificats déjà délivrés : le numéro peut n'exister
      // que dans la table certificates (numéro de publication ou de certificat).
      if (!resolved && /^[A-Z0-9-]{3,40}$/.test(code)) {
        const { data: cert } = await supabase
          .from("certificates")
          .select("publication_id")
          .or(`publication_number.eq.${code},certificate_number.eq.${code}`)
          .limit(1)
          .maybeSingle();
        resolved = cert?.publication_id ?? null;
      }
      if (!cancelled) setResolvedUuid(resolved);
    })();
    return () => { cancelled = true; };
  }, [rawId, isUuid, slugSuffix, initialPublicationId, resolveAttempt]);

  const id = isUuid ? rawId : (resolvedUuid || "");
  const { data: publication, isLoading, error, refetch: refetchPublication } = usePublication(id);
  const incrementViews = useIncrementViews();
  const incrementDownloads = useIncrementDownloads();
  const { user, authReady, isAdmin, adminChecking } = useAuth();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const { data: premiumEnforced } = usePremiumEnforced();
  const { hidePremiumUI } = useBillingConfig();
  const { t, language } = useLanguage();
  const { allowDownloads } = useDownloadSetting();
  const [offlineData, setOfflineData] = useState<OfflinePublication | null>(null);
  const [offlineLoading, setOfflineLoading] = useState(!isOnline);
  const [isCached, setIsCached] = useState(false);
  const [resumePage, setResumePage] = useState<number>(pageFromUrl || 1);
  const [currentViewPage, setCurrentViewPage] = useState<number>(pageFromUrl || 1);
  const { startReading, updateDuration, savePageProgress } = useTrackReading();
  const readingRecordId = useRef<string | null>(null);
  const readingStart = useRef<number>(Date.now());
  const currentPageRef = useRef<number>(resumePage);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incrementedViewForIdRef = useRef<string | null>(null);
  const routeKey = `${location.pathname}${location.search}`;
  const returnTo = typeof returnState?.returnTo === "string"
    ? returnState.returnTo
    : "/bibliotheque";
  const returnKey = returnState?.returnKey ?? null;
  const backTarget = useMemo(() => {
    if (!returnTo || returnTo.startsWith("/publication/")) {
      return "/bibliotheque";
    }

    return returnTo;
  }, [returnTo]);
  const backState = useMemo(
    () => ({
      restoredFromPublication: true,
      returnKey,
    }),
    [returnKey],
  );

  const handleBack = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      if (returnState?.returnTo && window.history.length > 1) {
        try {
          await ensureNavigationReady(returnState.returnTo);
        } catch {
          // ignore and continue navigation
        }
        navigate(-1);
        return;
      }

      try {
        await ensureNavigationReady(backTarget);
      } catch {
        // ignore and continue navigation
      }

      navigate(backTarget, { replace: true, state: backState });
    },
    [navigate, returnState, backTarget, backState],
  );

  // Pre-warm the back-target bundle as soon as Publication mounts so the
  // return navigation never triggers a Suspense flash (white page).
  useEffect(() => {
    prefetchRoute(backTarget);
    prefetchRoute("/bibliotheque");
    prefetchRoute("/");
  }, [backTarget]);


  // Fetch last read page from DB if not provided in URL
  useEffect(() => {
    if (!id || !user || pageFromUrl > 0) return;
    supabase
      .from("reading_history")
      .select("last_page_read")
      .eq("user_id", user.id)
      .eq("publication_id", id)
      .not("last_page_read", "is", null)
      .gt("last_page_read", 1)
      .order("started_at", { ascending: false })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].last_page_read) {
          const page = data[0].last_page_read;
          setResumePage(page);
          currentPageRef.current = page;
        }
      });
  }, [id, user, pageFromUrl]);

  useEffect(() => {
    setOfflineData(null);
    setOfflineLoading(!isOnline);
    setIsCached(false);
  }, [routeKey, isOnline]);

  const hasFullAccess = hidePremiumUI || isPremium;
  // Adresse du PDF : publique (livre gratuit) ou lien temporaire délivré par le serveur après
  // vérification de l'abonnement (livre Premium).
  const readingUrlQuery = useReadingUrl(publication as { id: string; access_level?: string | null; file_url: string | null } | undefined, isOnline);
  const readingUrl = readingUrlQuery.data ?? null;
  const serverDenied = readingUrlQuery.error instanceof ReadingAccessError ? readingUrlQuery.error : null;
  // Refus affiché IMMÉDIATEMENT quand l'appareil sait déjà que la personne n'y a pas droit (pas
  // connectée, ou connectée sans abonnement) : plus d'attente de la réponse du serveur (1 à 3 s).
  // Le serveur reste seul juge : s'il délivre finalement le lien, le PDF s'affiche à la place.
  const predictedDenied = (() => {
    if ((publication as { access_level?: string | null } | undefined)?.access_level !== "premium") return null;
    if (premiumEnforced === false || !authReady || readingUrlQuery.data || !readingUrlQuery.isFetching) return null;
    if (!user) return { code: "login_required" as const, message: "Connectez-vous pour lire ce document réservé aux abonnés." };
    if (subscriptionLoading || adminChecking || isAdmin || isPremium) return null;
    return { code: "premium_required" as const, message: "Ce document est réservé aux abonnés Premium." };
  })();
  const readingDenied: { code: string; message: string } | null = serverDenied ?? predictedDenied;
  // « Connectez-vous… » affiché : le lecteur va sans doute toucher « Se connecter » → bouton Google préchargé.
  useEffect(() => {
    if (readingDenied?.code === "login_required") void import("@/lib/google-gsi").then((m) => m.preloadGoogleSignIn());
  }, [readingDenied?.code]);
  const dateLocale = language === "fr" ? fr : enUS;

  // Load offline data if not online
  useEffect(() => {
    if (!id) return;
    // Check if cached
    isPublicationCached(id).then(setIsCached);
    if (!isOnline) {
      getOfflinePublication(id).then((data) => {
        setOfflineData(data);
        setOfflineLoading(false);
      });
    }
  }, [id, isOnline]);

  // Auto-save publication for offline when viewed online
  useEffect(() => {
    if (publication && isOnline && readingUrl) {
      savePublicationOffline({ ...publication, file_url: readingUrl }).then(() => setIsCached(true));
    }
  }, [publication, isOnline, readingUrl]);

  // Prevent copy, right-click and keyboard shortcuts
  const preventCopy = useCallback((e: Event) => {
    e.preventDefault();
    return false;
  }, []);

  const preventKeyboardShortcuts = useCallback((e: KeyboardEvent) => {
    if (
      (e.ctrlKey && (e.key === 'c' || e.key === 'p' || e.key === 's' || e.key === 'a')) ||
      (e.metaKey && (e.key === 'c' || e.key === 'p' || e.key === 's' || e.key === 'a')) ||
      e.key === 'PrintScreen'
    ) {
      e.preventDefault();
      return false;
    }
  }, []);

  const preventTouchMenu = useCallback((e: TouchEvent) => {
    if (e.touches.length > 1) e.preventDefault();
  }, []);

  const preventDrag = useCallback((e: DragEvent) => {
    e.preventDefault();
    return false;
  }, []);

  // Track reading time
  useEffect(() => {
    if (!id || !user || !isOnline) return;
    readingStart.current = Date.now();
    startReading.mutateAsync(id).then((recordId) => {
      if (recordId) readingRecordId.current = recordId;
    });

    const handleBeforeUnload = () => {
      if (readingRecordId.current) {
        const seconds = Math.floor((Date.now() - readingStart.current) / 1000);
        // Use sendBeacon for reliable save on page close
        const url = `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/reading_history?id=eq.${readingRecordId.current}`;
        const body = JSON.stringify({
          reading_duration_seconds: seconds,
          last_page_read: currentPageRef.current,
        });
        navigator.sendBeacon?.(url, new Blob([body], { type: "application/json" }));
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      if (readingRecordId.current) {
        const seconds = Math.floor((Date.now() - readingStart.current) / 1000);
        if (seconds > 2) {
          updateDuration.mutate({
            recordId: readingRecordId.current,
            seconds,
            lastPage: currentPageRef.current,
          });
        }
        readingRecordId.current = null;
      }
    };
  }, [id, user, isOnline]);

  // Save page progress on every page change (debounced)
  const handlePageChange = useCallback((page: number) => {
    currentPageRef.current = page;
    setCurrentViewPage(page);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (readingRecordId.current && page > 0) {
        savePageProgress.mutate({ recordId: readingRecordId.current, lastPage: page });
      }
    }, 1500);
  }, [savePageProgress]);

  useLayoutEffect(() => {
    if (id && incrementedViewForIdRef.current !== id) {
      incrementedViewForIdRef.current = id;
      incrementViews.mutate(id);
    }

    document.addEventListener('copy', preventCopy);
    document.addEventListener('cut', preventCopy);
    document.addEventListener('contextmenu', preventCopy);
    document.addEventListener('keydown', preventKeyboardShortcuts);
    document.addEventListener('touchstart', preventTouchMenu, { passive: false });
    document.addEventListener('dragstart', preventDrag);
    document.addEventListener('selectstart', preventCopy);
    document.body.style.webkitUserSelect = 'none';
    document.body.style.userSelect = 'none';

    return () => {
      document.removeEventListener('copy', preventCopy);
      document.removeEventListener('cut', preventCopy);
      document.removeEventListener('contextmenu', preventCopy);
      document.removeEventListener('keydown', preventKeyboardShortcuts);
      document.removeEventListener('touchstart', preventTouchMenu);
      document.removeEventListener('dragstart', preventDrag);
      document.removeEventListener('selectstart', preventCopy);
      document.body.style.webkitUserSelect = '';
      document.body.style.userSelect = '';
    };
  }, [id, incrementViews, preventCopy, preventKeyboardShortcuts, preventTouchMenu, preventDrag]);

  // Use offline data when not online
  const displayPub = isOnline ? publication : (offlineData || publication);
  // While we're still resolving a slug/publication_number to a UUID, keep the
  // loading skeleton visible to avoid a "not found" flash before the fetch runs.
  const resolvingId = !isUuid && resolvedUuid === undefined;
  const actualLoading = resolvingId || (isOnline ? (isLoading || subscriptionLoading || !id) : offlineLoading);

  if (actualLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <div className="animate-pulse space-y-8">
            <div className="h-8 bg-muted rounded w-32" />
            <div className="grid lg:grid-cols-3 gap-8">
              <div className="aspect-[3/4] bg-muted rounded-lg" />
              <div className="lg:col-span-2 space-y-4">
                <div className="h-10 bg-muted rounded w-3/4" />
                <div className="h-6 bg-muted rounded w-1/4" />
                <div className="h-24 bg-muted rounded" />
              </div>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  // Erreur réseau (et non « livre inexistant ») : PGRST116 = aucune ligne → vrai « introuvable ».
  const loadFailed = isOnline && (resolveFailed || (!!error && (error as { code?: string }).code !== "PGRST116"));
  if (!displayPub && loadFailed) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <WifiOff className="h-8 w-8 mx-auto text-amber-600 mb-4" />
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">Problème de connexion</h1>
          <p className="text-muted-foreground mb-6">Le document n'a pas pu être chargé. Vérifiez votre connexion internet, puis réessayez.</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={() => { setResolveAttempt((n) => n + 1); void refetchPublication(); }}>Réessayer</Button>
            <Button asChild variant="outline"><Link to="/bibliotheque">{t("pub.back")}</Link></Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (!displayPub) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          {!isOnline && (
            <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
              <WifiOff className="h-5 w-5" />
              <span className="text-sm font-medium">{t("pub.offlineMode")}</span>
            </div>
          )}
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">{t("pub.notFound")}</h1>
          <p className="text-muted-foreground mb-6">
            {!isOnline ? t("pub.notFoundOffline") : t("pub.notFoundOnline")}
          </p>
          <Button variant="outline" className="gap-2" asChild>
            <Link to={backTarget} replace state={backState} preventScrollReset onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
              {t("pub.back")}
            </Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const config = categoryConfig[displayPub.category as Category];
  const Icon = config.icon;

  // For offline, use local PDF URI if available
  const pdfUrl = !isOnline && offlineData?.local_pdf_uri
    ? offlineData.local_pdf_uri
    : readingUrl ?? ((displayPub as { access_level?: string | null }).access_level !== "premium" ? displayPub.file_url : null);

  const pubCategory = displayPub.category as Category | undefined;
  const pubType: "book" | "article" =
    pubCategory === "livre" ? "book" : "article";
  // Balises de référencement : même module que les pages prérendues et les Pages Functions
  // (src/seo/pageSeo.ts) — titre « Titre | Auteur | KMG Bibliothèque », JSON-LD, Open Graph.
  const seoPage = publicationSeo(displayPub as SeoPublication);
  const canonicalPath = seoPage.path;
  const coverAlt = seoPage.imageAlt;
  const authorPath = displayPub.author ? buildAuthorPath(displayPub.author) : null;

  const categoryLabel = config.label;
  const categoryRoute = categoryPath(displayPub.category);

  const seoKeywords = [
    displayPub.title,
    displayPub.author || "",
    categoryLabel,
    "KMG Bibliothèque",
    pubCategory === "livre" ? "livre numérique" : "",
    pubCategory === "memoire" ? "mémoire académique" : "",
    pubCategory === "tfc" ? "travail de fin de cycle" : "",
    pubCategory === "article" ? "article scientifique" : "",
  ].filter(Boolean);

  return (
    <Layout>
      <SEO
        title={seoPage.title}
        description={seoPage.description}
        path={canonicalPath}
        type={pubType}
        image={seoPage.image}
        keywords={seoKeywords}
        extraMeta={seoPage.extraMeta}
        jsonLd={seoPage.jsonLd}
      />

      <div className="container py-8 md:py-12">
        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-2 mb-6 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t("pub.offlineBanner")}</span>
          </div>
        )}

        <Breadcrumb
          items={[
            { label: "Bibliothèque", to: "/bibliotheque" },
            { label: categoryLabel, to: `/bibliotheque?category=${categoryRoute}` },
            { label: displayPub.title },
          ]}
        />

        <Link
          to={backTarget}
          replace
          state={backState}
          preventScrollReset
          onClick={handleBack}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("pub.back")}
        </Link>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Cover Image */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-elegant">
                {displayPub.cover_image_url ? (
                  <CachedImage
                    src={displayPub.cover_image_url}
                    alt={coverAlt}
                    className="h-full w-full object-cover"
                    containerClassName="h-full w-full"
                    fallbackIcon={<Icon className="h-24 w-24 text-muted-foreground/30" />}
                    loading="eager"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                    <Icon className="h-24 w-24 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Download Button */}
              <div className="mt-6 space-y-3">
                {readingUrl && hasFullAccess && isOnline && allowDownloads && (displayPub as any).allow_download !== false && (
                  <a
                    href={readingUrl}
                    download
                    onClick={() => {
                      incrementDownloads.mutate(displayPub.id);
                    }}
                  >
                    <Button className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      {t("pub.download")}
                    </Button>
                  </a>
                )}
                {isCached && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 justify-center">
                    <CheckCircle className="h-3.5 w-3.5" />
                    <span>{t("pub.availableOffline")}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge className={cn("text-sm", config.className)}>
                <Icon className="h-4 w-4 mr-1" />
                {config.label}
              </Badge>
              <FavoriteButton publicationId={id!} size="sm" />
              <ShareButtons
                title={displayPub.title}
                description={displayPub.description || undefined}
                publicationId={id!}
              />
            </div>

            <div className="lg:hidden">
              <div className="mx-auto w-full max-w-[17.5rem] sm:max-w-[19rem] md:max-w-sm">
                <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-elegant">
                  {displayPub.cover_image_url ? (
                    <CachedImage
                      src={displayPub.cover_image_url}
                      alt={coverAlt}
                      className="h-full w-full object-cover"
                      containerClassName="h-full w-full"
                      fallbackIcon={<Icon className="h-20 w-20 text-muted-foreground/30" />}
                      loading="eager"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                      <Icon className="h-20 w-20 text-muted-foreground/30" />
                    </div>
                  )}
                </div>

                <div className="mt-4 space-y-3">
                  {readingUrl && hasFullAccess && isOnline && allowDownloads && (displayPub as any).allow_download !== false && (
                    <a
                      href={readingUrl}
                      download
                      onClick={() => {
                        incrementDownloads.mutate(displayPub.id);
                      }}
                    >
                      <Button className="w-full gap-2">
                        <Download className="h-4 w-4" />
                        {t("pub.download")}
                      </Button>
                    </a>
                  )}
                  {isCached && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 justify-center">
                      <CheckCircle className="h-3.5 w-3.5" />
                      <span>{t("pub.availableOffline")}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {displayPub.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {authorPath ? (
                  <Link to={authorPath} className="hover:text-foreground hover:underline transition-colors">
                    {displayPub.author}
                  </Link>
                ) : (
                  <span>{displayPub.author}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(displayPub.created_at), "d MMMM yyyy", { locale: dateLocale })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{displayPub.views_count} {t("pub.views")}</span>
              </div>
            </div>

            {displayPub.description && (
              <div className="prose prose-lg max-w-none">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("pub.description")}</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {displayPub.description}
                </p>
              </div>
            )}

            {/* Certification numérique */}
            <CertificationSection
              publicationId={id!}
              certificationStatus={(displayPub as any).certification_status}
              publicationTitle={displayPub.title}
              publicationAuthor={displayPub.author}
              publicationCategory={displayPub.category}
              publicationDate={(displayPub as any).created_at}
            />

            {/* AI Summary */}
            <AISummary
              publicationId={id!}
              title={displayPub.title}
              author={displayPub.author}
              category={displayPub.category}
              description={displayPub.description || undefined}
              existingSummary={(displayPub as any).summary || null}
              isAdmin={false}
            />

            {/* Lecture refusée par le serveur (livre réservé aux abonnés) */}
            {!pdfUrl && readingDenied && (
              <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-500/5 p-6 text-center" id="document-viewer">
                <Lock className="h-8 w-8 mx-auto text-amber-600 mb-3" />
                <p className="font-semibold text-foreground mb-1">{readingDenied.message}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {readingDenied.code === "login_required" ? (
                    <Button asChild><Link to="/auth">Se connecter</Link></Button>
                  ) : (
                    <Button asChild><Link to="/abonnement/payer">Voir les formules Premium</Link></Button>
                  )}
                </div>
              </div>
            )}

            {/* PDF Viewer + Annotations */}
            {pdfUrl && (
              <div className="mt-8" id="document-viewer">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("pub.document")}</h2>
                <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-4">
                  {/* min-w-0 : une page zoomée défile dans le lecteur au lieu d'élargir la colonne. */}
                  <div className="min-w-0">
                    <ProtectedPdfViewer
                      fileUrl={pdfUrl}
                      title={displayPub.title}
                      initialPage={resumePage}
                      onPageChange={handlePageChange}
                    />
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Lock className="h-3 w-3" />
                      {t("pub.protected")}
                    </p>
                  </div>
                  <AnnotationsPanel publicationId={id!} currentPage={currentViewPage} />
                </div>
              </div>
            )}

            {/* Comments Section */}
            <div className="mt-10 border-t border-border pt-8">
              <CommentsList publicationId={id!} />
            </div>

            {/* Maillage interne SEO : auteur, catégorie, bibliothèque */}
            <nav
              aria-label="Explorer davantage"
              className="mt-10 border-t border-border pt-6 flex flex-wrap gap-2 text-sm"
            >
              {authorPath && (
                <Link
                  to={authorPath}
                  className="px-3 py-1.5 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                  rel="author"
                >
                  Toutes les publications de {displayPub.author}
                </Link>
              )}
              <Link
                to={`/bibliotheque?category=${displayPub.category}`}
                className="px-3 py-1.5 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-colors"
              >
                Plus de {categoryLabel.toLowerCase()}
              </Link>
              <Link
                to="/bibliotheque"
                className="px-3 py-1.5 rounded-full bg-muted text-foreground hover:bg-muted/70 transition-colors"
              >
                Explorer toute la bibliothèque
              </Link>
            </nav>

            {/* Livres similaires — maillage interne SEO */}
            <SimilarBooks
              id={displayPub.id}
              category={displayPub.category}
              author={displayPub.author}
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useEffect, useCallback, useState, useRef } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Book, FileText, GraduationCap, Newspaper, Eye, Calendar, User, Lock, Download, WifiOff, CheckCircle, Heart } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CachedImage } from "@/components/ui/cached-image";
import { ProtectedPdfViewer } from "@/components/publications/ProtectedPdfViewer";
import { usePublication, useIncrementViews } from "@/hooks/usePublications";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { useOnlineStatus } from "@/hooks/useOffline";
import { useLanguage } from "@/contexts/LanguageContext";
import { savePublicationOffline, getOfflinePublication, isPublicationCached, type OfflinePublication } from "@/lib/offline-storage";
import { useTrackReading } from "@/hooks/useReadingHistory";
import { FavoriteButton } from "@/components/publications/FavoriteButton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import { toast } from "sonner";

type Category = "livre" | "memoire" | "tfc" | "article";

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-secondary/80 text-secondary-foreground" },
  tfc: { label: "TFC", icon: FileText, className: "bg-accent text-accent-foreground" },
  article: { label: "Article", icon: Newspaper, className: "bg-muted text-muted-foreground" },
};

export default function Publication() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const isOnline = useOnlineStatus();
  const { data: publication, isLoading, error } = usePublication(id || "");
  const incrementViews = useIncrementViews();
  const { user } = useAuth();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const { hidePremiumUI } = useBillingConfig();
  const { t, language } = useLanguage();
  const [offlineData, setOfflineData] = useState<OfflinePublication | null>(null);
  const [offlineLoading, setOfflineLoading] = useState(!isOnline);
  const [isCached, setIsCached] = useState(false);
  const { startReading, updateDuration, savePageProgress } = useTrackReading();
  const readingRecordId = useRef<string | null>(null);
  const readingStart = useRef<number>(Date.now());
  const currentPageRef = useRef<number>(initialPage);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasFullAccess = hidePremiumUI || isPremium;
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
    if (publication && isOnline) {
      savePublicationOffline(publication).then(() => setIsCached(true));
    }
  }, [publication, isOnline]);

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
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      if (readingRecordId.current && page > 0) {
        savePageProgress.mutate({ recordId: readingRecordId.current, lastPage: page });
      }
    }, 1500);
  }, [savePageProgress]);

  useEffect(() => {
    // Scroll to top when opening the publication
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });

    if (id) incrementViews.mutate(id);

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
  }, [id, preventCopy, preventKeyboardShortcuts, preventTouchMenu, preventDrag]);

  // Use offline data when not online
  const displayPub = isOnline ? publication : (offlineData || publication);
  const actualLoading = isOnline ? (isLoading || subscriptionLoading) : offlineLoading;

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
          <Link to="/bibliotheque">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              {t("pub.back")}
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const config = categoryConfig[displayPub.category as Category];
  const Icon = config.icon;

  // For offline, use local PDF URI if available
  const pdfUrl = !isOnline && offlineData?.local_pdf_uri
    ? offlineData.local_pdf_uri
    : displayPub.file_url;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        {/* Offline banner */}
        {!isOnline && (
          <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 rounded-lg px-4 py-2 mb-6 text-sm">
            <WifiOff className="h-4 w-4 shrink-0" />
            <span>{t("pub.offlineBanner")}</span>
          </div>
        )}

        <Link
          to="/bibliotheque"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("pub.back")}
        </Link>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Cover Image */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-elegant">
                {displayPub.cover_image_url ? (
                  <CachedImage
                    src={displayPub.cover_image_url}
                    alt={displayPub.title}
                    className="h-full w-full object-cover"
                    containerClassName="h-full w-full"
                    fallbackIcon={<Icon className="h-24 w-24 text-muted-foreground/30" />}
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                    <Icon className="h-24 w-24 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Download Button */}
              <div className="mt-6 space-y-3">
                {displayPub.file_url && hasFullAccess && isOnline && (
                  <a href={displayPub.file_url} download>
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
            <div className="flex items-center gap-2">
              <Badge className={cn("text-sm", config.className)}>
                <Icon className="h-4 w-4 mr-1" />
                {config.label}
              </Badge>
              <FavoriteButton publicationId={id!} size="sm" />
            </div>

            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {displayPub.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{displayPub.author}</span>
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

            {/* PDF Viewer */}
            {pdfUrl && (
              <div className="mt-8" id="document-viewer">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">{t("pub.document")}</h2>
                <ProtectedPdfViewer
                  fileUrl={pdfUrl}
                  title={displayPub.title}
                  initialPage={initialPage}
                  onPageChange={(page) => { currentPageRef.current = page; }}
                />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  {t("pub.protected")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

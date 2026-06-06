import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Lock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Maximize2, Minimize2, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getCachedPdfBlobUrl } from "@/lib/pdf-cache";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProtectedPdfViewerProps {
  fileUrl: string;
  title: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

const FULLSCREEN_PREF_PREFIX = "pdfViewer:fullscreen:";
const FULLSCREEN_AUTO_DISABLED_PREFIX = "pdfViewer:fullscreenAutoDisabled:";
const PAGE_PREF_PREFIX = "pdfViewer:page:";
const ZOOM_PREF_PREFIX = "pdfViewer:zoom:";
const SCROLL_PREF_PREFIX = "pdfViewer:scroll:";

export function ProtectedPdfViewer({ fileUrl, title, initialPage, onPageChange }: ProtectedPdfViewerProps) {
  const prefKey = useMemo(() => `${FULLSCREEN_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const autoDisabledKey = useMemo(() => `${FULLSCREEN_AUTO_DISABLED_PREFIX}${fileUrl}`, [fileUrl]);
  const pageKey = useMemo(() => `${PAGE_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const zoomKey = useMemo(() => `${ZOOM_PREF_PREFIX}${fileUrl}`, [fileUrl]);
  const scrollKey = useMemo(() => `${SCROLL_PREF_PREFIX}${fileUrl}`, [fileUrl]);

  // Read locally-saved zoom (per document)
  const initialStoredZoom = useMemo(() => {
    try {
      const raw = localStorage.getItem(zoomKey);
      const n = raw ? parseFloat(raw) : NaN;
      if (!Number.isNaN(n) && n >= 0.3 && n <= 3) return n;
    } catch { /* ignore */ }
    return null;
  }, [zoomKey]);

  // Read locally-saved page as a fallback (works offline / unlogged / reload)
  const initialResolvedPage = useMemo(() => {
    if (initialPage && initialPage > 1) return initialPage;
    try {
      const stored = localStorage.getItem(pageKey);
      const n = stored ? parseInt(stored, 10) : NaN;
      if (!Number.isNaN(n) && n > 1) return n;
    } catch { /* ignore */ }
    return 1;
  }, [initialPage, pageKey]);

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialResolvedPage);
  const [scale, setScale] = useState(1);
  const [userZoomed, setUserZoomed] = useState(false);
  const [fitScale, setFitScale] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResumeBadge, setShowResumeBadge] = useState(initialResolvedPage > 1);
  const [needsFullscreenGesture, setNeedsFullscreenGesture] = useState(false);
  const [autoFullscreenDisabled, setAutoFullscreenDisabled] = useState<boolean>(() => {
    try { return localStorage.getItem(`${FULLSCREEN_AUTO_DISABLED_PREFIX}${fileUrl}`) === "1"; }
    catch { return false; }
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement | null>(null);
  const pageNativeWidthRef = useRef<number | null>(null);
  // Always render with the direct URL to avoid a remount/reload when a cached blob is found.
  // Warm the HTTP/Cache Storage cache in the background so subsequent opens are faster, but
  // never swap the URL after the first paint — that causes the visible "double load".
  const resolvedUrl = fileUrl;

  useEffect(() => {
    if (typeof caches === "undefined") return;
    getCachedPdfBlobUrl(fileUrl).catch(() => {});
  }, [fileUrl]);

  const documentSource = useMemo(() => ({ url: resolvedUrl, withCredentials: false }), [resolvedUrl]);

  // pdf.js options: enable range/stream so pages render before the full file is downloaded,
  // and ship cMap + standard fonts from the CDN to avoid missing-glyph warnings/retries.
  const pdfOptions = useMemo(() => ({
    cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfjs.version}/standard_fonts/`,
    disableAutoFetch: true,   // don't prefetch the entire PDF up front
    disableStream: false,     // allow chunked streaming as the user navigates
    isEvalSupported: false,
  }), []);

  // Render at the device's actual pixel ratio (capped at 3) so text stays crisp,
  // especially on high-DPI phones where the previous 1.25 cap caused visible blur.
  const canvasDpr = useMemo(
    () => Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 3),
    [],
  );

  // Compute a "fit-to-width" scale based on the visible container and the page's
  // native width. Re-runs on resize, fullscreen toggle, and orientation changes.
  const recomputeFitScale = useCallback(() => {
    const el = scrollAreaRef.current;
    const native = pageNativeWidthRef.current;
    if (!el || !native) return;
    // Leave a small horizontal padding so the page doesn't touch the edges.
    const available = Math.max(0, el.clientWidth - 16);
    if (available <= 0) return;
    const next = Math.max(0.3, Math.min(2.5, available / native));
    setFitScale(next);
    setScale((prev) => (userZoomed ? prev : next));
  }, [userZoomed]);

  useEffect(() => {
    const onResize = () => recomputeFitScale();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
    };
  }, [recomputeFitScale]);

  useEffect(() => { recomputeFitScale(); }, [isFullscreen, recomputeFitScale]);

  // Persist current page locally on every change
  useEffect(() => {
    try {
      if (currentPage > 1) localStorage.setItem(pageKey, String(currentPage));
      else localStorage.removeItem(pageKey);
    } catch { /* ignore */ }
  }, [currentPage, pageKey]);

  // Sync with initialPage when it changes (e.g. from DB fetch)
  useEffect(() => {
    if (initialPage && initialPage > 1) {
      setCurrentPage(initialPage);
      setShowResumeBadge(true);
      const t = setTimeout(() => setShowResumeBadge(false), 5000);
      return () => clearTimeout(t);
    }
  }, [initialPage]);

  const toggleAutoFullscreen = useCallback(() => {
    setAutoFullscreenDisabled((prev) => {
      const next = !prev;
      try {
        if (next) {
          localStorage.setItem(autoDisabledKey, "1");
          // Also clear any stored "should restore" flag so it doesn't fire next time
          localStorage.removeItem(prefKey);
        } else {
          localStorage.removeItem(autoDisabledKey);
        }
      } catch { /* ignore */ }
      if (next) setNeedsFullscreenGesture(false);
      return next;
    });
  }, [autoDisabledKey, prefKey]);

  // Track native fullscreen state (handles ESC key) & persist preference per document
  useEffect(() => {
    const handler = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      try {
        if (active) localStorage.setItem(prefKey, "1");
        else localStorage.removeItem(prefKey);
      } catch {
        // ignore storage errors
      }
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, [prefKey]);

  const enterFullscreen = useCallback(async () => {
    if (document.fullscreenElement || !containerRef.current?.requestFullscreen) return false;
    try {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
      setNeedsFullscreenGesture(false);
      return true;
    } catch {
      return false;
    }
  }, []);

  // Auto-restore fullscreen preference for this document once loaded
  useEffect(() => {
    if (loading || autoFullscreenDisabled) return;
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(prefKey);
    } catch {
      stored = null;
    }
    if (stored !== "1" || document.fullscreenElement) return;
    enterFullscreen().then((ok) => {
      if (!ok) setNeedsFullscreenGesture(true);
    });
  }, [loading, prefKey, enterFullscreen, autoFullscreenDisabled]);

  // If the browser blocked auto fullscreen (needs gesture), retry on first tap in the viewer
  useEffect(() => {
    if (!needsFullscreenGesture) return;
    const el = containerRef.current;
    if (!el) return;
    const handler = () => { enterFullscreen(); };
    el.addEventListener("pointerdown", handler, { once: true });
    return () => el.removeEventListener("pointerdown", handler);
  }, [needsFullscreenGesture, enterFullscreen]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  const goToPrev = () => setCurrentPage((p) => { const next = Math.max(1, p - 1); onPageChange?.(next); return next; });
  const goToNext = () => setCurrentPage((p) => { const next = Math.min(numPages, p + 1); onPageChange?.(next); return next; });
  const zoomIn = () => { setUserZoomed(true); setScale((s) => Math.min(3, +(s + 0.25).toFixed(2))); };
  const zoomOut = () => { setUserZoomed(true); setScale((s) => Math.max(0.3, +(s - 0.25).toFixed(2))); };
  const resetZoom = () => { setUserZoomed(false); if (fitScale) setScale(fitScale); };

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        const ok = await enterFullscreen();
        if (!ok) setIsFullscreen((v) => !v);
        try { localStorage.setItem(prefKey, "1"); } catch { /* ignore */ }
      } else if (document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
        try { localStorage.removeItem(prefKey); } catch { /* ignore */ }
      }
    } catch {
      setIsFullscreen((v) => !v);
    }
  };

  const retry = () => {
    setError(false);
    setLoading(true);
  };

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-muted p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/60" />
        <p className="text-muted-foreground mb-2">Impossible de charger le document.</p>
        <p className="text-xs text-muted-foreground mb-4">Vérifiez votre connexion et réessayez.</p>
        <Button variant="outline" onClick={retry} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Réessayer
        </Button>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "rounded-xl overflow-hidden border border-border bg-muted relative select-none",
        isFullscreen && "fixed inset-0 z-[100] rounded-none border-0",
      )}
      style={{
        WebkitUserSelect: "none",
        MozUserSelect: "none" as any,
        msUserSelect: "none" as any,
        userSelect: "none",
        WebkitTouchCallout: "none",
      }}
      onContextMenu={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 bg-card border-b border-border px-3 py-2 flex-wrap">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrev} disabled={currentPage <= 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[70px] text-center">
            {currentPage} / {numPages || "…"}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNext} disabled={currentPage >= numPages} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.3} className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={resetZoom}
            className="text-xs text-muted-foreground min-w-[44px] text-center hover:text-foreground transition-colors"
            title="Ajuster à la largeur"
          >
            {Math.round(scale * 100)}%
          </button>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 3} className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button
            variant={isFullscreen ? "secondary" : "default"}
            size="sm"
            onClick={toggleFullscreen}
            className={cn(
              "h-9 gap-1.5 px-3 font-semibold shadow-lg ring-2 ring-primary/40",
              !isFullscreen && "bg-primary text-primary-foreground hover:bg-primary/90",
            )}
            aria-label={isFullscreen ? "Quitter le plein écran" : "Lire en plein écran"}
            title={isFullscreen ? "Quitter le plein écran" : "Lire en plein écran"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            <span className="text-xs font-semibold hidden sm:inline">
              {isFullscreen ? "Quitter" : "Lire en plein écran"}
            </span>
            <span className="text-xs font-semibold sm:hidden">
              {isFullscreen ? "Quitter" : "Plein écran"}
            </span>
          </Button>
        </div>
      </div>

      {/* Fullscreen hint — disappears once fullscreen is active */}
      {!isFullscreen && (
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] sm:text-xs text-primary font-medium animate-fade-in">
          <div className="flex items-center gap-1.5">
            <Maximize2 className="h-3 w-3 shrink-0" />
            <span>
              {needsFullscreenGesture
                ? "Touchez le document pour reprendre le plein écran"
                : "Astuce : appuyez sur « Lire en plein écran » pour une meilleure lecture"}
            </span>
          </div>
          <button
            type="button"
            onClick={toggleAutoFullscreen}
            className="underline underline-offset-2 hover:text-primary/80 transition-colors"
            aria-pressed={!autoFullscreenDisabled}
            title="Activer ou désactiver la reprise automatique du plein écran pour ce document"
          >
            {autoFullscreenDisabled
              ? "Réactiver la reprise auto du plein écran"
              : "Désactiver la reprise auto du plein écran"}
          </button>
        </div>
      )}

      {/* Resume badge */}
      {showResumeBadge && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-30 bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full shadow-elegant flex items-center gap-1.5 animate-slide-up">
          <BookmarkCheck className="h-3.5 w-3.5" />
          Reprise à la page {currentPage}
        </div>
      )}

      {/* PDF Content */}
      <div
        ref={scrollAreaRef}
        className={cn(
          "overflow-auto flex justify-center items-start py-4 px-2 bg-muted/50",
          isFullscreen ? "h-[calc(100dvh-48px)]" : "max-h-[75vh] min-h-[50vh]",
        )}
        style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-[1px]" aria-hidden="true">
            <div className="h-full w-full animate-pulse bg-gradient-to-b from-background/0 via-background/10 to-background/0" />
          </div>
        )}
        {resolvedUrl && (
        <Document
          key={resolvedUrl}
          file={documentSource}
          options={pdfOptions}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="select-none mx-auto"
        >
          <Page
            key={`page-${currentPage}`}
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            devicePixelRatio={canvasDpr}
            loading={null}
            className="shadow-lg mx-auto"
            onLoadSuccess={(page) => {
              // page.originalWidth / page.view[2] is the PDF's native point width.
              const w = (page as any).originalWidth ?? page.view?.[2];
              if (w && pageNativeWidthRef.current !== w) {
                pageNativeWidthRef.current = w;
                recomputeFitScale();
              }
            }}
          />
        </Document>
        )}
      </div>

      {/* Watermark */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08]"
        style={{ zIndex: 10 }}
      >
        <div className="text-4xl font-bold text-foreground rotate-[-30deg] whitespace-nowrap">
          KMG LECTURE
        </div>
      </div>

      {/* Protection badge */}
      <div className="absolute bottom-2 right-2 bg-background/80 backdrop-blur-sm px-3 py-1.5 rounded-lg flex items-center gap-2 text-xs text-muted-foreground z-20">
        <Lock className="h-3 w-3" />
        Document protégé
      </div>
    </div>
  );
}

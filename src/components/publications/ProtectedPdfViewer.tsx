import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Lock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, AlertCircle, RefreshCw, Maximize2, Minimize2, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProtectedPdfViewerProps {
  fileUrl: string;
  title: string;
  initialPage?: number;
  onPageChange?: (page: number) => void;
}

export function ProtectedPdfViewer({ fileUrl, title, initialPage, onPageChange }: ProtectedPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(initialPage || 1);
  const [scale, setScale] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showResumeBadge, setShowResumeBadge] = useState(!!initialPage && initialPage > 1);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentSource = useMemo(() => ({ url: fileUrl, withCredentials: false }), [fileUrl]);

  // Sync with initialPage when it changes (e.g. from DB fetch)
  useEffect(() => {
    if (initialPage && initialPage > 1) {
      setCurrentPage(initialPage);
      setShowResumeBadge(true);
      const t = setTimeout(() => setShowResumeBadge(false), 5000);
      return () => clearTimeout(t);
    }
  }, [initialPage]);

  // Track native fullscreen state (handles ESC key)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

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
  const zoomIn = () => setScale((s) => Math.min(2.5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
        await containerRef.current.requestFullscreen();
        setIsFullscreen(true);
        // Auto zoom for better readability in fullscreen
        setScale((s) => (s < 1 ? 1 : s));
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch {
      // Fallback: toggle a CSS-only fullscreen flag
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
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5} className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[36px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 2.5} className="h-8 w-8">
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
        <div className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-primary/10 border-b border-primary/20 text-[11px] sm:text-xs text-primary font-medium animate-fade-in">
          <Maximize2 className="h-3 w-3 shrink-0" />
          <span>Astuce : appuyez sur « Lire en plein écran » pour une meilleure lecture</span>
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
        className={cn(
          "overflow-auto flex justify-center py-4 bg-muted/50",
          isFullscreen ? "h-[calc(100vh-48px)]" : "max-h-[70vh] min-h-[50vh]",
        )}
      >
        {loading && (
          <div className="absolute inset-0 z-10 bg-background/70 backdrop-blur-[1px]" aria-hidden="true">
            <div className="h-full w-full animate-pulse bg-gradient-to-b from-background/0 via-background/10 to-background/0" />
          </div>
        )}
        <Document
          file={documentSource}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={null}
          className="select-none"
        >
          <Page
            pageNumber={currentPage}
            scale={scale}
            renderTextLayer={false}
            renderAnnotationLayer={false}
            loading={null}
            className="shadow-lg"
          />
        </Document>
      </div>

      {/* Watermark */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-[0.08]"
        style={{ zIndex: 10 }}
      >
        <div className="text-4xl font-bold text-foreground rotate-[-30deg] whitespace-nowrap">
          PLUME D'OR KMG - LECTURE SEULE
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

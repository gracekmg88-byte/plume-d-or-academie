import { useState, useCallback, useEffect, useMemo } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Lock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, AlertCircle, RefreshCw } from "lucide-react";
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
  const documentSource = useMemo(() => ({ url: fileUrl, withCredentials: false }), [fileUrl]);

  // Sync with initialPage when it changes (e.g. from DB fetch)
  useEffect(() => {
    if (initialPage && initialPage > 1) {
      setCurrentPage(initialPage);
    }
  }, [initialPage]);

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
      className="rounded-xl overflow-hidden border border-border bg-muted relative select-none"
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
      <div className="flex items-center justify-between bg-card border-b border-border px-4 py-2">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={goToPrev} disabled={currentPage <= 1} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-muted-foreground min-w-[80px] text-center">
            {currentPage} / {numPages || "…"}
          </span>
          <Button variant="ghost" size="icon" onClick={goToNext} disabled={currentPage >= numPages} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={zoomOut} disabled={scale <= 0.5} className="h-8 w-8">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[40px] text-center">
            {Math.round(scale * 100)}%
          </span>
          <Button variant="ghost" size="icon" onClick={zoomIn} disabled={scale >= 2.5} className="h-8 w-8">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* PDF Content */}
      <div className="overflow-auto max-h-[70vh] min-h-[50vh] flex justify-center py-4 bg-muted/50">
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

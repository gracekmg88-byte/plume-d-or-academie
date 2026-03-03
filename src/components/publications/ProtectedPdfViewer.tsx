import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";
import "react-pdf/dist/esm/Page/TextLayer.css";
import { Lock, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// Configure pdf.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface ProtectedPdfViewerProps {
  fileUrl: string;
  title: string;
}

export function ProtectedPdfViewer({ fileUrl, title }: ProtectedPdfViewerProps) {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(0.5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback(() => {
    setError(true);
    setLoading(false);
  }, []);

  const goToPrev = () => setCurrentPage((p) => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage((p) => Math.min(numPages, p + 1));
  const zoomIn = () => setScale((s) => Math.min(2.5, s + 0.25));
  const zoomOut = () => setScale((s) => Math.max(0.5, s - 0.25));

  if (error) {
    return (
      <div className="rounded-xl border border-border bg-muted p-8 text-center">
        <AlertCircle className="h-12 w-12 mx-auto mb-4 text-destructive/60" />
        <p className="text-muted-foreground mb-2">Impossible de charger le document.</p>
        <p className="text-xs text-muted-foreground">Vérifiez votre connexion et réessayez.</p>
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
      <div className="overflow-auto max-h-[70vh] flex justify-center py-4 bg-muted/50">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center z-10 bg-muted/80">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Chargement du document…</span>
            </div>
          </div>
        )}
        <Document
          file={fileUrl}
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

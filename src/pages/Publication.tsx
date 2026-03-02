import { useEffect, useCallback, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Book, FileText, GraduationCap, Newspaper, Eye, Calendar, User, Lock, Download } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CachedImage } from "@/components/ui/cached-image";
import { ProtectedPdfViewer } from "@/components/publications/ProtectedPdfViewer";
import { usePublication, useIncrementViews } from "@/hooks/usePublications";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Category = "livre" | "memoire" | "tfc" | "article";

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-secondary/80 text-secondary-foreground" },
  tfc: { label: "TFC", icon: FileText, className: "bg-accent text-accent-foreground" },
  article: { label: "Article", icon: Newspaper, className: "bg-muted text-muted-foreground" },
};

export default function Publication() {
  const { id } = useParams<{ id: string }>();
  const { data: publication, isLoading, error } = usePublication(id || "");
  const incrementViews = useIncrementViews();
  const { user } = useAuth();
  const { isPremium, isLoading: subscriptionLoading } = useSubscription();
  const { hidePremiumUI } = useBillingConfig();

  const hasFullAccess = hidePremiumUI || isPremium;

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

  if (isLoading || subscriptionLoading) {
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

  if (error || !publication) {
    return (
      <Layout>
        <div className="container py-12 text-center">
          <h1 className="font-serif text-2xl font-bold text-foreground mb-4">
            Publication non trouvée
          </h1>
          <p className="text-muted-foreground mb-6">
            Cette publication n'existe pas ou n'est plus disponible.
          </p>
          <Link to="/bibliotheque">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Retour à la bibliothèque
            </Button>
          </Link>
        </div>
      </Layout>
    );
  }

  const config = categoryConfig[publication.category as Category];
  const Icon = config.icon;

  return (
    <Layout>
      <div className="container py-8 md:py-12">
        <Link
          to="/bibliotheque"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la bibliothèque
        </Link>

        <div className="grid lg:grid-cols-3 gap-8 lg:gap-12">
          {/* Cover Image */}
          <div className="lg:col-span-1">
            <div className="sticky top-24">
              <div className="aspect-[3/4] rounded-xl overflow-hidden bg-muted shadow-elegant">
                {publication.cover_image_url ? (
                  <CachedImage
                    src={publication.cover_image_url}
                    alt={publication.title}
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
                {publication.file_url && hasFullAccess && (
                  <a href={publication.file_url} download>
                    <Button className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Télécharger le document
                    </Button>
                  </a>
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
            </div>

            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {publication.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{publication.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(publication.created_at), "d MMMM yyyy", { locale: fr })}</span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{publication.views_count} consultations</span>
              </div>
            </div>

            {publication.description && (
              <div className="prose prose-lg max-w-none">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Description</h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {publication.description}
                </p>
              </div>
            )}

            {/* PDF Viewer */}
            {publication.file_url && (
              <div className="mt-8" id="document-viewer">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">Document</h2>
                <ProtectedPdfViewer fileUrl={publication.file_url} title={publication.title} />
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                  <Lock className="h-3 w-3" />
                  Ce document est protégé. La copie est interdite.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

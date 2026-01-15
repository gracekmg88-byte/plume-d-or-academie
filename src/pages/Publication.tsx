import { useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Book, FileText, GraduationCap, Newspaper, Eye, Calendar, User, Download } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePublication, useIncrementViews } from "@/hooks/usePublications";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Category = "livre" | "memoire" | "tfc" | "article";

const categoryConfig: Record<Category, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-blue-500/10 text-blue-600" },
  tfc: { label: "TFC", icon: FileText, className: "bg-green-500/10 text-green-600" },
  article: { label: "Article", icon: Newspaper, className: "bg-purple-500/10 text-purple-600" },
};

export default function Publication() {
  const { id } = useParams<{ id: string }>();
  const { data: publication, isLoading, error } = usePublication(id || "");
  const incrementViews = useIncrementViews();

  useEffect(() => {
    if (id) {
      incrementViews.mutate(id);
    }
  }, [id]);

  if (isLoading) {
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
        {/* Back Link */}
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
                  <img
                    src={publication.cover_image_url}
                    alt={publication.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-muted to-accent">
                    <Icon className="h-24 w-24 text-muted-foreground/30" />
                  </div>
                )}
              </div>

              {/* Actions */}
              {publication.file_url && (
                <div className="mt-6 space-y-3">
                  <a href={publication.file_url} target="_blank" rel="noopener noreferrer">
                    <Button className="w-full gap-2">
                      <Eye className="h-4 w-4" />
                      Lire en ligne
                    </Button>
                  </a>
                  <a href={publication.file_url} download>
                    <Button variant="outline" className="w-full gap-2">
                      <Download className="h-4 w-4" />
                      Télécharger
                    </Button>
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-2 space-y-6">
            <Badge className={cn("text-sm", config.className)}>
              <Icon className="h-4 w-4 mr-1" />
              {config.label}
            </Badge>

            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-foreground leading-tight">
              {publication.title}
            </h1>

            {/* Meta Info */}
            <div className="flex flex-wrap gap-4 text-muted-foreground">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4" />
                <span>{publication.author}</span>
              </div>
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>
                  {format(new Date(publication.created_at), "d MMMM yyyy", { locale: fr })}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4" />
                <span>{publication.views_count} consultations</span>
              </div>
            </div>

            {/* Description */}
            {publication.description && (
              <div className="prose prose-lg max-w-none">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                  Description
                </h2>
                <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {publication.description}
                </p>
              </div>
            )}

            {/* PDF Viewer */}
            {publication.file_url && (
              <div className="mt-8">
                <h2 className="font-serif text-xl font-semibold text-foreground mb-4">
                  Aperçu du document
                </h2>
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-border bg-muted">
                  <iframe
                    src={`${publication.file_url}#view=FitH`}
                    className="h-full w-full"
                    title={publication.title}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

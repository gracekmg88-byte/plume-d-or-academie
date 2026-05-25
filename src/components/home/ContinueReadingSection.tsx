import { Link, useLocation } from "react-router-dom";
import { BookOpen, ArrowRight, Book, GraduationCap, FileText, Newspaper } from "lucide-react";
import { CachedImage } from "@/components/ui/cached-image";
import { useContinueReading } from "@/hooks/useContinueReading";
import { cn } from "@/lib/utils";
import { preloadPublicationFlow } from "@/lib/route-preload";
import { saveScrollPosition } from "@/lib/scroll-restoration";

const categoryConfig: Record<string, { label: string; icon: typeof Book; className: string }> = {
  livre: { label: "Livre", icon: Book, className: "bg-primary/10 text-primary" },
  memoire: { label: "Mémoire", icon: GraduationCap, className: "bg-secondary/80 text-secondary-foreground" },
  tfc: { label: "TFC", icon: FileText, className: "bg-accent text-accent-foreground" },
  article: { label: "Article", icon: Newspaper, className: "bg-muted text-muted-foreground" },
};

export function ContinueReadingSection() {
  const { data: items, isLoading } = useContinueReading(3);
  const { pathname } = useLocation();

  const saveScroll = () => {
    saveScrollPosition(window.history.state?.key, pathname, window.scrollY);
    preloadPublicationFlow();
  };

  if (isLoading) {
    return (
      <section className="py-12 md:py-16 bg-card border-y border-border">
        <div className="container">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="h-6 w-6 text-primary" />
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
              📖 Continuer la lecture
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="animate-pulse flex gap-4 bg-muted/50 rounded-xl p-4">
                <div className="w-16 h-20 bg-muted rounded-lg shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-3/4" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                  <div className="h-3 bg-muted rounded w-1/3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!items || items.length === 0) return null;

  return (
    <section className="py-12 md:py-16 bg-card border-y border-border overflow-hidden">
      <div className="container">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
            📖 Continuer la lecture
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((item) => {
            const config = categoryConfig[item.category] || categoryConfig.livre;
            const Icon = config.icon;

            return (
              <div key={item.publication_id} data-publication-card-id={item.publication_id}>
                <Link
                  to={`/publication/${item.publication_id}?page=${item.last_page_read}`}
                  state={{
                    returnTo: `${pathname}${window.location.search}`,
                    returnKey: window.history.state?.key ?? null,
                    returnPublicationId: item.publication_id,
                  }}
                  onPointerDown={saveScroll}
                  onMouseEnter={saveScroll}
                  onClickCapture={saveScroll}
                  className="group flex gap-4 bg-background rounded-xl border border-border p-4 hover:shadow-elegant transition-all duration-300 h-full"
                >
                  <div className="w-16 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
                    {item.cover_image_url ? (
                      <CachedImage
                        src={item.cover_image_url}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        containerClassName="h-full w-full"
                        fallbackIcon={<Icon className="h-6 w-6 text-muted-foreground/30" />}
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <Icon className="h-6 w-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mb-1", config.className)}>
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </div>
                    <h3 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{item.author}</p>
                    <p className="text-xs text-primary font-medium mt-1 flex items-center gap-1">
                      Reprendre à la page {item.last_page_read}
                      <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                    </p>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

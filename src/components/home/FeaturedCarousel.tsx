import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";
import { ChevronLeft, ChevronRight, Sparkles, Eye } from "lucide-react";
import { useFeaturedPublications } from "@/hooks/useFeaturedPublications";
import { CachedImage, preloadImages } from "@/components/ui/cached-image";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";

const categoryLabel: Record<string, string> = {
  livre: "Livre",
  memoire: "Mémoire",
  tfc: "TFC",
  article: "Article",
};

export function FeaturedCarousel() {
  const { data: publications, isLoading } = useFeaturedPublications(8);
  const { t } = useLanguage();
  const autoplay = useRef(
    Autoplay({ delay: 4000, stopOnInteraction: false, stopOnMouseEnter: true })
  );
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start", dragFree: false },
    [autoplay.current]
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [scrollSnaps, setScrollSnaps] = useState<number[]>([]);

  useEffect(() => {
    if (publications?.length) {
      const urls = publications
        .map((p) => p.cover_image_url)
        .filter((u): u is string => !!u);
      preloadImages(urls);
    }
  }, [publications]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelectedIndex(emblaApi.selectedScrollSnap());
    setScrollSnaps(emblaApi.scrollSnapList());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  if (isLoading) {
    return (
      <section className="py-8 md:py-12 bg-background">
        <div className="container">
          <div className="flex gap-4 overflow-hidden">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="min-w-[60%] sm:min-w-[40%] md:min-w-[28%] lg:min-w-[22%] aspect-[3/4] bg-muted animate-pulse rounded-xl"
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!publications || publications.length === 0) return null;

  return (
    <section className="py-8 md:py-12 bg-gradient-to-b from-background via-background to-card/30">
      <div className="container">
        <div className="flex items-end justify-between mb-6 md:mb-8">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="h-3.5 w-3.5" />
              <span className="text-xs font-medium uppercase tracking-wider">
                À la une
              </span>
            </div>
            <h2 className="font-serif text-2xl md:text-3xl lg:text-4xl font-bold text-foreground">
              Sélection du moment
            </h2>
          </div>
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => emblaApi?.scrollPrev()}
              className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              aria-label="Précédent"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              onClick={() => emblaApi?.scrollNext()}
              className="h-10 w-10 rounded-full bg-card border border-border flex items-center justify-center hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all"
              aria-label="Suivant"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-hidden -mx-2" ref={emblaRef}>
          <div className="flex">
            {publications.map((pub) => (
              <div
                key={pub.id}
                className="flex-[0_0_70%] sm:flex-[0_0_45%] md:flex-[0_0_32%] lg:flex-[0_0_24%] px-2"
              >
                <Link
                  to={`/publication/${pub.id}`}
                  className="group block rounded-xl overflow-hidden bg-card border border-border hover:border-primary/50 hover:shadow-elegant transition-all duration-300"
                >
                  <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                    {pub.cover_image_url ? (
                      <CachedImage
                        src={pub.cover_image_url}
                        alt={pub.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">
                        {pub.title}
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute top-2 left-2">
                      <span className="px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider rounded-full bg-primary/90 text-primary-foreground backdrop-blur-sm">
                        {categoryLabel[pub.category] || pub.category}
                      </span>
                    </div>
                    <div className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-black/60 text-white text-[10px] backdrop-blur-sm">
                      <Eye className="h-3 w-3" />
                      {pub.views_count}
                    </div>
                  </div>
                  <div className="p-3 space-y-1">
                    <h3 className="font-serif text-sm md:text-base font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors">
                      {pub.title}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-1">
                      {pub.author}
                    </p>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        </div>

        {scrollSnaps.length > 1 && (
          <div className="flex justify-center gap-1.5 mt-6">
            {scrollSnaps.map((_, i) => (
              <button
                key={i}
                onClick={() => emblaApi?.scrollTo(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === selectedIndex
                    ? "w-6 bg-primary"
                    : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50"
                }`}
                aria-label={`Aller à la diapositive ${i + 1}`}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

import { Sparkles, Book, GraduationCap, FileText, Newspaper } from "lucide-react";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { useRecommendations } from "@/hooks/useRecommendations";
import { motion } from "framer-motion";

const categoryIcons: Record<string, typeof Book> = {
  livre: Book,
  memoire: GraduationCap,
  tfc: FileText,
  article: Newspaper,
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] as const },
  },
};

const headingVariants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.6, ease: "easeOut" as const },
  },
};

export function RecommendationsSection() {
  const { data: recommendations, isLoading } = useRecommendations(5);

  if (isLoading) {
    return (
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="flex items-center gap-3 mb-8">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
              📚 Recommandé pour vous
            </h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[3/4] bg-muted rounded-lg mb-4" />
                <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-background overflow-hidden">
      <div className="container">
        <motion.div
          className="flex items-center gap-3 mb-8"
          variants={headingVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
            📚 Recommandé pour vous
          </h2>
        </motion.div>
        <motion.div
          className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
        >
          {recommendations.map((pub) => (
            <motion.div key={pub.id} variants={itemVariants}>
              <PublicationCard
                id={pub.id}
                title={pub.title}
                author={pub.author}
                category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                coverImageUrl={pub.cover_image_url || undefined}
                viewsCount={pub.views_count}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

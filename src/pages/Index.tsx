import { Link } from "react-router-dom";
import { ArrowRight, Book, FileText, GraduationCap, Newspaper, Users, Award, BookOpen } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { usePublications } from "@/hooks/usePublications";
import heroImage from "@/assets/hero-library.jpg";

const stats = [
  { icon: Book, label: "Livres", value: "50+" },
  { icon: GraduationCap, label: "Mémoires", value: "100+" },
  { icon: FileText, label: "TFC", value: "200+" },
  { icon: Newspaper, label: "Articles", value: "150+" },
];

const features = [
  {
    icon: BookOpen,
    title: "Accès libre",
    description: "Consultez gratuitement tous nos contenus académiques sans inscription.",
  },
  {
    icon: Users,
    title: "Ressources académiques",
    description: "Mémoires, TFC et articles rédigés par des étudiants et chercheurs.",
  },
  {
    icon: Award,
    title: "Qualité garantie",
    description: "Tous les contenus sont vérifiés et validés avant publication.",
  },
];

export default function Index() {
  const { data: publications, isLoading } = usePublications();
  const recentPublications = publications?.slice(0, 4) || [];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={heroImage}
            alt="Bibliothèque académique"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-secondary/95 via-secondary/80 to-secondary/60" />
        </div>
        
        <div className="relative container py-20 md:py-32 lg:py-40">
          <div className="max-w-2xl space-y-6 animate-slide-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/20 text-primary-foreground border border-primary/30">
              <Book className="h-4 w-4" />
              <span className="text-sm font-medium">Bibliothèque Académique Numérique</span>
            </div>
            
            <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-bold text-secondary-foreground leading-tight">
              Plume d'Or <span className="text-primary">KMG</span>
            </h1>
            
            <p className="text-lg md:text-xl text-secondary-foreground/80 leading-relaxed">
              Votre passerelle vers le savoir. Explorez notre collection de livres, mémoires, TFC et articles académiques.
            </p>
            
            <div className="flex flex-wrap gap-4 pt-4">
              <Link to="/bibliotheque">
                <Button size="lg" className="gap-2 shadow-lg">
                  Explorer la bibliothèque
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/a-propos">
                <Button size="lg" variant="outline" className="bg-secondary-foreground/10 border-secondary-foreground/20 text-secondary-foreground hover:bg-secondary-foreground/20">
                  En savoir plus
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-card border-y border-border">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="text-center space-y-2">
                  <Icon className="h-8 w-8 mx-auto text-primary" />
                  <div className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              Pourquoi Plume d'Or KMG ?
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Une plateforme dédiée à la diffusion du savoir académique et à la valorisation des travaux de recherche.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group p-6 rounded-xl bg-card border border-border hover:shadow-elegant transition-all duration-300"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <Icon className="h-6 w-6 text-primary group-hover:text-primary-foreground" />
                  </div>
                  <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Recent Publications */}
      <section className="py-16 md:py-24 bg-parchment">
        <div className="container">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-12">
            <div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
                Publications récentes
              </h2>
              <p className="text-muted-foreground">
                Découvrez les dernières additions à notre bibliothèque.
              </p>
            </div>
            <Link to="/bibliotheque">
              <Button variant="outline" className="gap-2">
                Voir tout
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="aspect-[3/4] bg-muted rounded-lg mb-4" />
                  <div className="h-4 bg-muted rounded w-3/4 mb-2" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : recentPublications.length > 0 ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {recentPublications.map((pub) => (
                <PublicationCard
                  key={pub.id}
                  id={pub.id}
                  title={pub.title}
                  author={pub.author}
                  description={pub.description || undefined}
                  category={pub.category as "livre" | "memoire" | "tfc" | "article"}
                  coverImageUrl={pub.cover_image_url || undefined}
                  viewsCount={pub.views_count}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune publication disponible pour le moment.</p>
            </div>
          )}
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 md:py-24 bg-secondary">
        <div className="container text-center">
          <div className="max-w-2xl mx-auto space-y-6">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-secondary-foreground">
              Prêt à explorer ?
            </h2>
            <p className="text-secondary-foreground/80 text-lg leading-relaxed">
              Accédez à notre collection complète de ressources académiques et enrichissez vos connaissances.
            </p>
            <Link to="/bibliotheque">
              <Button size="lg" className="gap-2 mt-4">
                Parcourir la bibliothèque
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </Layout>
  );
}

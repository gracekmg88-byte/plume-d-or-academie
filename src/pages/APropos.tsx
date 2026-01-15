import { BookOpen, Target, Users, Award, Heart, Lightbulb } from "lucide-react";
import { Layout } from "@/components/layout/Layout";

const values = [
  {
    icon: BookOpen,
    title: "Excellence académique",
    description: "Nous promouvons la qualité et la rigueur dans tous les travaux publiés.",
  },
  {
    icon: Users,
    title: "Accessibilité",
    description: "Le savoir doit être accessible à tous, sans barrières géographiques ou économiques.",
  },
  {
    icon: Heart,
    title: "Partage du savoir",
    description: "Nous croyons au pouvoir transformateur de la connaissance partagée.",
  },
  {
    icon: Lightbulb,
    title: "Innovation",
    description: "Nous encourageons la créativité et les nouvelles perspectives de recherche.",
  },
];

export default function APropos() {
  return (
    <Layout>
      {/* Header */}
      <section className="bg-secondary py-12 md:py-20">
        <div className="container">
          <div className="max-w-3xl animate-slide-up">
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-bold text-secondary-foreground mb-6">
              À propos de Plume d'Or KMG
            </h1>
            <p className="text-secondary-foreground/80 text-lg md:text-xl leading-relaxed">
              Une bibliothèque académique numérique dédiée à la diffusion du savoir et à la valorisation des travaux de recherche.
            </p>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
                <Target className="h-4 w-4" />
                <span className="text-sm font-medium">Notre mission</span>
              </div>
              <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                Démocratiser l'accès au savoir académique
              </h2>
              <div className="space-y-4 text-muted-foreground leading-relaxed">
                <p>
                  Plume d'Or KMG est née de la conviction que le savoir académique doit être accessible à tous. Notre plateforme rassemble des livres, mémoires, TFC et articles scientifiques pour offrir une ressource éducative de qualité.
                </p>
                <p>
                  Nous accompagnons les étudiants, chercheurs et passionnés dans leur quête de connaissances en leur donnant accès à une bibliothèque numérique riche et variée.
                </p>
                <p>
                  Chaque publication est soigneusement sélectionnée pour garantir la qualité et la pertinence des contenus proposés.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-accent overflow-hidden">
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8">
                    <Award className="h-24 w-24 mx-auto text-primary mb-6" />
                    <h3 className="font-serif text-2xl font-bold text-foreground mb-2">
                      Qualité garantie
                    </h3>
                    <p className="text-muted-foreground">
                      Tous nos contenus sont vérifiés et validés
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-16 md:py-24 bg-parchment">
        <div className="container">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nos valeurs
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Les principes qui guident notre mission de partage du savoir.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value) => {
              const Icon = value.icon;
              return (
                <div
                  key={value.title}
                  className="group p-6 rounded-xl bg-card border border-border hover:shadow-elegant transition-all duration-300 text-center"
                >
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary transition-colors">
                    <Icon className="h-7 w-7 text-primary group-hover:text-primary-foreground transition-colors" />
                  </div>
                  <h3 className="font-serif text-lg font-semibold text-foreground mb-2">
                    {value.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-16 md:py-24 bg-background">
        <div className="container">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <h2 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
              Notre histoire
            </h2>
            <div className="text-muted-foreground leading-relaxed space-y-4 text-left md:text-center">
              <p>
                Fondée avec la passion de rendre le savoir accessible, Plume d'Or KMG est le fruit d'une vision simple : créer un espace où les travaux académiques peuvent être partagés et consultés librement.
              </p>
              <p>
                Notre nom évoque la plume d'or, symbole de l'écriture noble et du savoir précieux. Nous aspirons à être cette plume qui trace le chemin de la connaissance pour les générations présentes et futures.
              </p>
              <p>
                Aujourd'hui, nous continuons de développer notre collection pour offrir toujours plus de ressources à notre communauté d'apprenants et de chercheurs.
              </p>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}

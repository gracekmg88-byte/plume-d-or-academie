import { Link } from "react-router-dom";
import {
  Check,
  X,
  BookOpen,
  Download,
  Eye,
  Sparkles,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useBillingConfig } from "@/hooks/useBillingConfig";

const freeFeatures = [
  { text: "Lecture en ligne", included: true },
  { text: "Accès à tous les documents", included: true },
  { text: "Navigation dans la bibliothèque", included: true },
  { text: "Téléchargement des documents", included: true },
];

export default function Abonnement() {
  const { user } = useAuth();
  const { hidePremiumUI, comingSoonMessage } = useBillingConfig();

  // When billing is disabled, show a simple free access page
  if (hidePremiumUI) {
    return (
      <Layout>
        <div className="container py-12 md:py-20">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
              Accès gratuit à la bibliothèque
            </h1>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Profitez d'un accès complet à notre collection de documents académiques.
            </p>
          </div>

          {/* Free Access Card */}
          <div className="max-w-md mx-auto mb-16">
            <Card className="relative border-2 border-primary shadow-elegant">
              <CardHeader className="text-center pb-2">
                <CardTitle className="font-serif text-2xl">Accès Gratuit</CardTitle>
                <CardDescription>Tous les documents disponibles</CardDescription>
                <div className="mt-4">
                  <span className="font-serif text-4xl font-bold text-foreground">Gratuit</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-3">
                  {freeFeatures.map((feature, idx) => (
                    <li key={idx} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{feature.text}</span>
                    </li>
                  ))}
                </ul>

                {!user ? (
                  <Link to="/auth" className="block">
                    <Button className="w-full">
                      Créer un compte gratuit
                    </Button>
                  </Link>
                ) : (
                  <Link to="/bibliotheque" className="block">
                    <Button className="w-full">
                      Explorer la bibliothèque
                    </Button>
                  </Link>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Features */}
          <div className="bg-card rounded-2xl border border-border p-8 md:p-12 max-w-4xl mx-auto mb-16">
            <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
              Ce qui est inclus
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <div className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <BookOpen className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Lecture complète</h3>
                <p className="text-sm text-muted-foreground">
                  Accédez à l'intégralité de chaque document, sans limitation.
                </p>
              </div>
              <div className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Download className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Téléchargement</h3>
                <p className="text-sm text-muted-foreground">
                  Téléchargez les documents pour une lecture hors ligne.
                </p>
              </div>
              <div className="text-center">
                <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Eye className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">Catalogue complet</h3>
                <p className="text-sm text-muted-foreground">
                  Explorez notre bibliothèque de livres, mémoires, TFC et articles.
                </p>
              </div>
            </div>
          </div>

          {/* Coming Soon Message */}
          <div className="max-w-2xl mx-auto">
            <Card className="border-dashed">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">
                      Nouveautés à venir
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {comingSoonMessage}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </Layout>
    );
  }

  // Original subscription page when billing is enabled (future use)
  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="text-center max-w-3xl mx-auto">
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Abonnement
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Les options d'abonnement seront disponibles prochainement.
          </p>
        </div>
      </div>
    </Layout>
  );
}

import { Link } from "react-router-dom";
import {
  Crown,
  Check,
  X,
  Smartphone,
  Building2,
  MessageCircle,
  ArrowRight,
  BookOpen,
  Download,
  Eye,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { usePaymentSettings } from "@/hooks/usePaymentSettings";

const freeFeatures = [
  { text: "Lecture en ligne", included: true },
  { text: "Aperçu limité (20%)", included: true },
  { text: "Accès aux titres et descriptions", included: true },
  { text: "Lecture complète des documents", included: false },
  { text: "Téléchargement des documents", included: false },
  { text: "Contenus exclusifs", included: false },
];

const premiumFeatures = [
  { text: "Lecture en ligne", included: true },
  { text: "Lecture complète (100%)", included: true },
  { text: "Accès aux titres et descriptions", included: true },
  { text: "Lecture complète des documents", included: true },
  { text: "Téléchargement des documents", included: true },
  { text: "Contenus exclusifs", included: true },
];

export default function Abonnement() {
  const { user } = useAuth();
  const { isPremium } = useSubscription();
  const { settings } = usePaymentSettings();

  const whatsappLink = `https://wa.me/${settings.payment_whatsapp.replace(/\s/g, "").replace("+", "")}?text=${encodeURIComponent("Bonjour, je souhaite activer mon compte Premium sur Plume d'Or KMG. Voici ma preuve de paiement :")}`;

  return (
    <Layout>
      <div className="container py-12 md:py-20">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <Badge className="bg-primary/10 text-primary border-primary/20 mb-4">
            <Crown className="h-3 w-3 mr-1" />
            Abonnement Premium
          </Badge>
          <h1 className="font-serif text-4xl md:text-5xl font-bold text-foreground mb-4">
            Accédez à tout le savoir
          </h1>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Débloquez l'accès complet à notre bibliothèque avec le téléchargement illimité et la lecture intégrale de tous les documents.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
          {/* Free Plan */}
          <Card className="relative border-2 border-border">
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl">Gratuit</CardTitle>
              <CardDescription>Pour découvrir la plateforme</CardDescription>
              <div className="mt-4">
                <span className="font-serif text-4xl font-bold text-foreground">0 $</span>
                <span className="text-muted-foreground">/toujours</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {freeFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    {feature.included ? (
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    ) : (
                      <X className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                    )}
                    <span
                      className={
                        feature.included ? "text-foreground" : "text-muted-foreground/50"
                      }
                    >
                      {feature.text}
                    </span>
                  </li>
                ))}
              </ul>

              {!user ? (
                <Link to="/auth" className="block">
                  <Button variant="outline" className="w-full">
                    Créer un compte gratuit
                  </Button>
                </Link>
              ) : (
                <Button variant="outline" className="w-full" disabled>
                  Plan actuel
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="relative border-2 border-primary shadow-elegant">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <Badge className="bg-primary text-primary-foreground px-4">
                Recommandé
              </Badge>
            </div>
            <CardHeader className="text-center pb-2">
              <CardTitle className="font-serif text-2xl flex items-center justify-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                Premium
              </CardTitle>
              <CardDescription>Accès complet illimité</CardDescription>
              <div className="mt-4">
                <span className="font-serif text-4xl font-bold text-foreground">{settings.payment_amount} $</span>
                <span className="text-muted-foreground">/unique</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {premiumFeatures.map((feature, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <Check className="h-5 w-5 text-primary flex-shrink-0" />
                    <span className="text-foreground">{feature.text}</span>
                  </li>
                ))}
              </ul>

              {isPremium ? (
                <Button className="w-full" disabled>
                  <Crown className="h-4 w-4 mr-2" />
                  Vous êtes Premium
                </Button>
              ) : (
                <a href="#payment" className="block">
                  <Button className="w-full gap-2">
                    Passer à Premium
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Why Premium */}
        <div className="bg-card rounded-2xl border border-border p-8 md:p-12 max-w-4xl mx-auto mb-16">
          <h2 className="font-serif text-2xl md:text-3xl font-bold text-foreground text-center mb-8">
            Pourquoi passer à Premium ?
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
                Téléchargez tous les documents pour une lecture hors ligne.
              </p>
            </div>
            <div className="text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Eye className="h-7 w-7 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">Contenus exclusifs</h3>
              <p className="text-sm text-muted-foreground">
                Accédez aux publications réservées aux membres Premium.
              </p>
            </div>
          </div>
        </div>

        {/* Payment Section */}
        <div id="payment" className="max-w-2xl mx-auto">
          <Card className="shadow-elegant border-primary/20">
            <CardHeader className="text-center">
              <CardTitle className="font-serif text-2xl flex items-center justify-center gap-2">
                <Crown className="h-6 w-6 text-primary" />
                Comment devenir Premium ?
              </CardTitle>
              <CardDescription className="text-base">
                Procédure simple en 3 étapes
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              {/* Steps */}
              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                    1
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Effectuez le paiement de {settings.payment_amount} $
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Utilisez l'un des moyens de paiement ci-dessous
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                    2
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Envoyez la preuve de paiement
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Via WhatsApp au {settings.payment_mobile_number}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center flex-shrink-0 font-bold">
                    3
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground mb-1">
                      Votre compte sera activé
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      Sous 24h après vérification du paiement
                    </p>
                  </div>
                </div>
              </div>

              {/* Payment Methods */}
              <div className="bg-muted/50 rounded-xl p-6 space-y-6">
                <h4 className="font-semibold text-foreground text-center">
                  Moyens de paiement
                </h4>

                {/* Mobile Money */}
                <div className="bg-background rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Smartphone className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-foreground">Mobile Money</h5>
                      <p className="text-xs text-muted-foreground">M-Pesa, Airtel Money, Orange Money</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Numéro :</span>{" "}
                      <span className="font-semibold text-foreground">{settings.payment_mobile_number}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Bénéficiaire :</span>{" "}
                      <span className="font-semibold text-foreground">{settings.payment_mobile_name}</span>
                    </p>
                  </div>
                </div>

                {/* Bank Transfer */}
                <div className="bg-background rounded-lg p-4 border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h5 className="font-semibold text-foreground">Virement bancaire</h5>
                      <p className="text-xs text-muted-foreground">{settings.payment_bank_name}</p>
                    </div>
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>
                      <span className="text-muted-foreground">Numéro de compte :</span>{" "}
                      <span className="font-semibold text-foreground">{settings.payment_bank_account}</span>
                    </p>
                    <p>
                      <span className="text-muted-foreground">Bénéficiaire :</span>{" "}
                      <span className="font-semibold text-foreground">{settings.payment_bank_beneficiary}</span>
                    </p>
                  </div>
                </div>

                {/* WhatsApp */}
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block"
                >
                  <Button variant="outline" className="w-full gap-2 border-primary/50 text-primary hover:bg-primary/10">
                    <MessageCircle className="h-4 w-4" />
                    Envoyer la preuve via WhatsApp
                  </Button>
                </a>
              </div>

              {/* CTA */}
              {!user && (
                <div className="text-center pt-4 border-t border-border">
                  <p className="text-sm text-muted-foreground mb-4">
                    Vous n'avez pas encore de compte ?
                  </p>
                  <Link to="/auth">
                    <Button variant="outline" className="gap-2">
                      Créer un compte gratuit
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

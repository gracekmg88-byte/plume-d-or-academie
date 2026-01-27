import { useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Crown, Calendar, LogOut, Star } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function Profil() {
  const { user, loading, signOut } = useAuth();
  const { profile, isPremium, isLoading: profileLoading } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  if (loading || profileLoading) {
    return (
      <Layout>
        <div className="container py-12">
          <div className="animate-pulse space-y-8 max-w-2xl mx-auto">
            <div className="h-8 bg-muted rounded w-48" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        </div>
      </Layout>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <Layout>
      <div className="container py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
              Mon Profil
            </h1>
            <p className="text-muted-foreground">
              Gérez votre compte et votre abonnement
            </p>
          </div>

          {/* Profile Card */}
          <Card className="shadow-elegant">
            <CardHeader className="text-center pb-2">
              <div className="mx-auto h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <User className="h-10 w-10 text-primary" />
              </div>
              <CardTitle className="font-serif text-2xl">
                {profile?.full_name || "Utilisateur"}
              </CardTitle>
              <CardDescription className="flex items-center justify-center gap-2">
                <Mail className="h-4 w-4" />
                {user.email}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Subscription Status */}
              <div className="bg-muted/50 rounded-xl p-6 text-center">
                <div className="flex items-center justify-center gap-2 mb-4">
                  {isPremium ? (
                    <>
                      <Crown className="h-6 w-6 text-primary" />
                      <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1">
                        PREMIUM
                      </Badge>
                    </>
                  ) : (
                    <>
                      <Star className="h-6 w-6 text-muted-foreground" />
                      <Badge variant="secondary" className="text-lg px-4 py-1">
                        GRATUIT
                      </Badge>
                    </>
                  )}
                </div>

                {isPremium ? (
                  <div className="space-y-2">
                    <p className="text-foreground font-medium">
                      Vous avez accès à tous les contenus premium !
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Téléchargement illimité et lecture complète de tous les documents
                    </p>
                    {profile?.subscription_updated_at && (
                      <p className="text-xs text-muted-foreground mt-4">
                        <Calendar className="h-3 w-3 inline mr-1" />
                        Activé le{" "}
                        {format(new Date(profile.subscription_updated_at), "d MMMM yyyy", {
                          locale: fr,
                        })}
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <p className="text-muted-foreground">
                      Passez à Premium pour accéder à tous les contenus !
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>✓ Lecture complète de tous les documents</p>
                      <p>✓ Téléchargement illimité</p>
                      <p>✓ Accès à tous les contenus premium</p>
                    </div>
                    <Link to="/abonnement">
                      <Button className="w-full gap-2 mt-4">
                        <Crown className="h-4 w-4" />
                        Passer à Premium - 5 $
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Account Info */}
              <div className="border-t border-border pt-6">
                <h3 className="font-semibold text-foreground mb-4">Informations du compte</h3>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membre depuis</span>
                    <span className="text-foreground">
                      {profile?.created_at
                        ? format(new Date(profile.created_at), "d MMMM yyyy", { locale: fr })
                        : "-"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type de compte</span>
                    <span className="text-foreground capitalize">
                      {profile?.subscription_type || "gratuit"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={handleSignOut}
              >
                <LogOut className="h-4 w-4" />
                Se déconnecter
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}

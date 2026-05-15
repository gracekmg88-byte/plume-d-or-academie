import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Mail, Crown, Calendar, LogOut, Star, BookOpen, Trash2, WifiOff, HardDrive } from "lucide-react";
import { NotificationPreferencesCard } from "@/components/profile/NotificationPreferencesCard";
import { FavoritesSection } from "@/components/profile/FavoritesSection";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";
import { getAllOfflinePublications, removeOfflinePublication, type OfflinePublication } from "@/lib/offline-storage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { SEO } from "@/components/seo/SEO";
import { toast } from "sonner";

export default function Profil() {
  const { user, loading, signOut } = useAuth();
  const { profile, isPremium, isLoading: profileLoading } = useSubscription();
  const { hidePremiumUI } = useBillingConfig();
  const navigate = useNavigate();
  const [cachedPubs, setCachedPubs] = useState<OfflinePublication[]>([]);
  const [cacheLoading, setCacheLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  // Load cached publications
  useEffect(() => {
    getAllOfflinePublications().then((pubs) => {
      setCachedPubs(pubs);
      setCacheLoading(false);
    });
  }, []);

  const handleRemoveCached = async (id: string, title: string) => {
    await removeOfflinePublication(id);
    setCachedPubs((prev) => prev.filter((p) => p.id !== id));
    toast.success(`"${title}" supprimé du cache`);
  };

  const handleClearAll = async () => {
    for (const pub of cachedPubs) {
      await removeOfflinePublication(pub.id);
    }
    setCachedPubs([]);
    toast.success("Cache hors ligne vidé");
  };

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
      <SEO title="Mon profil — Plume d'Or KMG" description="Espace personnel : favoris, historique de lecture, préférences et publications hors-ligne." path="/profil" noindex />
      <div className="container py-12">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="text-center">
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground mb-2">
              Mon Profil
            </h1>
            <p className="text-muted-foreground">
              Gérez votre compte
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
              {/* Access Status */}
              <div className="bg-muted/50 rounded-xl p-6 text-center">
                {hidePremiumUI ? (
                  // When billing is disabled, show simple access status
                  <div className="space-y-4">
                    <div className="flex items-center justify-center gap-2 mb-4">
                      <BookOpen className="h-6 w-6 text-primary" />
                      <Badge className="bg-primary text-primary-foreground text-lg px-4 py-1">
                        ACCÈS COMPLET
                      </Badge>
                    </div>
                    <p className="text-foreground font-medium">
                      Vous avez accès à tous les contenus !
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Lecture et téléchargement de tous les documents
                    </p>
                  </div>
                ) : (
                  // Original premium/free status when billing is enabled
                  <>
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
                            Voir les options
                          </Button>
                        </Link>
                      </div>
                    )}
                  </>
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
                </div>
              </div>
              {/* Favorites */}
              <FavoritesSection />

              {/* Notification Preferences */}
              <NotificationPreferencesCard />

              {/* Offline Cache Management */}
              <div className="border-t border-border pt-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-foreground flex items-center gap-2">
                    <HardDrive className="h-4 w-4" />
                    Cache hors ligne
                  </h3>
                  {cachedPubs.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 text-xs"
                      onClick={handleClearAll}
                    >
                      <Trash2 className="h-3 w-3 mr-1" />
                      Tout supprimer
                    </Button>
                  )}
                </div>

                {cacheLoading ? (
                  <div className="animate-pulse space-y-2">
                    <div className="h-10 bg-muted rounded" />
                    <div className="h-10 bg-muted rounded" />
                  </div>
                ) : cachedPubs.length === 0 ? (
                  <div className="text-center py-6">
                    <WifiOff className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      Aucune publication en cache.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Les publications consultées seront automatiquement mises en cache.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground mb-3">
                      {cachedPubs.length} publication{cachedPubs.length > 1 ? "s" : ""} disponible{cachedPubs.length > 1 ? "s" : ""} hors ligne
                    </p>
                    {cachedPubs.map((pub) => (
                      <div
                        key={pub.id}
                        className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5"
                      >
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-sm font-medium text-foreground truncate">
                            {pub.title}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {pub.author}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                          onClick={() => handleRemoveCached(pub.id, pub.title)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>


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

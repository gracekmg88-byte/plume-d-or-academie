import { Link } from "react-router-dom";
import { Crown, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useBillingConfig } from "@/hooks/useBillingConfig";

interface PremiumGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showOverlay?: boolean;
}

export function PremiumGate({ children, fallback, showOverlay = false }: PremiumGateProps) {
  const { user } = useAuth();
  const { isPremium, isLoading } = useSubscription();
  const { hidePremiumUI } = useBillingConfig();

  // When billing is disabled, show content as if user is premium (free access)
  if (hidePremiumUI) {
    return <>{children}</>;
  }

  if (isLoading) {
    return (
      <div className="animate-pulse bg-muted rounded-lg h-32" />
    );
  }

  if (isPremium) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (showOverlay) {
    return (
      <div className="relative">
        <div className="pointer-events-none opacity-30 blur-sm">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
          <PremiumLockMessage />
        </div>
      </div>
    );
  }

  return <PremiumLockMessage />;
}

export function PremiumLockMessage() {
  const { user } = useAuth();
  const { hidePremiumUI, comingSoonMessage } = useBillingConfig();

  // When billing is disabled, show a neutral "coming soon" message instead
  if (hidePremiumUI) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 text-center max-w-md mx-auto">
        <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <Sparkles className="h-7 w-7 text-primary" />
        </div>
        <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
          Fonctionnalités avancées
        </h3>
        <p className="text-sm text-muted-foreground">
          {comingSoonMessage}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl p-6 text-center max-w-md mx-auto">
      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
        <Lock className="h-7 w-7 text-primary" />
      </div>
      <h3 className="font-serif text-xl font-semibold text-foreground mb-2">
        Contenu réservé aux abonnés
      </h3>
      <p className="text-sm text-muted-foreground mb-6">
        {user
          ? "Passez à Premium pour accéder à ce contenu et profiter de tous les avantages."
          : "Connectez-vous et passez à Premium pour accéder à ce contenu."}
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {!user && (
          <Link to="/auth">
            <Button variant="outline">Se connecter</Button>
          </Link>
        )}
        <Link to="/abonnement">
          <Button className="gap-2">
            <Crown className="h-4 w-4" />
            Voir les options
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function PremiumBadge() {
  const { hidePremiumUI } = useBillingConfig();
  
  // Hide premium badge when billing is disabled
  if (hidePremiumUI) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
      <Crown className="h-3 w-3" />
      Premium
    </span>
  );
}

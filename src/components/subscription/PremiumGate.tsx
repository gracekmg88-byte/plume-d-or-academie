import { Link } from "react-router-dom";
import { Crown, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";

interface PremiumGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showOverlay?: boolean;
}

export function PremiumGate({ children, fallback, showOverlay = false }: PremiumGateProps) {
  const { user } = useAuth();
  const { isPremium, isLoading } = useSubscription();

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
            S'abonner - 5 $
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
      <Crown className="h-3 w-3" />
      Premium
    </span>
  );
}

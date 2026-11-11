import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth-audit";
import { preloadAdminRoutes } from "@/lib/route-preload";
import { toast } from "sonner";

interface AdminGuardProps {
  children: React.ReactNode;
}

// Module-level cache: once the server has verified this user as admin in this
// session, we trust the client `isAdmin` for subsequent route changes and
// don't show the "Vérification des droits d'accès…" screen again.
const serverVerifiedUsers = new Set<string>();

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isAdmin, authReady, adminChecking } = useAuth();
  const location = useLocation();
  const alreadyVerified = !!user && serverVerifiedUsers.has(user.id);
  const [serverVerified, setServerVerified] = useState<boolean | null>(
    alreadyVerified ? true : null,
  );
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    // Warm all admin route bundles so navigation between admin pages is instant.
    preloadAdminRoutes();
  }, []);

  // L'objet `user` change à chaque renouvellement de session : la vérification ne dépend que
  // de l'identifiant, pour ne pas être relancée (et annulée) à chaque renouvellement.
  const userId = user?.id ?? null;

  useEffect(() => {
    let cancelled = false;

    if (!authReady || adminChecking) return;

    if (!user) {
      logAuthEvent("admin_route_denied", {
        metadata: { reason: "no_session", path: location.pathname },
      });
      setVerifying(false);
      setServerVerified(false);
      return;
    }

    if (!isAdmin) {
      setVerifying(false);
      logAuthEvent("admin_route_denied", {
        user_id: user.id,
        email: user.email ?? null,
        is_admin: false,
        metadata: { reason: "client_not_admin", path: location.pathname },
      });
      setServerVerified(false);
      return;
    }

    // Already verified this session — skip the server round-trip.
    if (serverVerifiedUsers.has(user.id)) {
      setVerifying(false);
      setServerVerified(true);
      return;
    }

    // First-time verification only.
    setVerifying(true);
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("verify-admin");
        if (cancelled) return;
        if (error || !data?.isAdmin) {
          logAuthEvent("admin_route_denied", {
            user_id: user.id,
            email: user.email ?? null,
            is_admin: false,
            metadata: {
              reason: "server_denied",
              path: location.pathname,
              error: error?.message,
            },
          });
          setServerVerified(false);
        } else {
          serverVerifiedUsers.add(user.id);
          logAuthEvent("admin_route_granted", {
            user_id: user.id,
            email: user.email ?? null,
            is_admin: true,
            metadata: { path: location.pathname },
          });
          setServerVerified(true);
        }
      } catch (e) {
        if (cancelled) return;
        logAuthEvent("admin_route_denied", {
          user_id: user.id,
          email: user.email ?? null,
          metadata: { reason: "verify_threw", path: location.pathname },
        });
        setServerVerified(false);
      } finally {
        if (!cancelled) setVerifying(false);
      }
    })();

    return () => {
      cancelled = true;
      // Une vérification annulée ne doit jamais laisser l'indicateur de chargement actif.
      setVerifying(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `user` est suivi via `userId` (voir plus haut)
  }, [authReady, adminChecking, userId, isAdmin, location.pathname]);


  if (!authReady || adminChecking || verifying || serverVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user) {
    toast.error("Vous devez vous connecter en tant qu'administrateur.");
    return <Navigate to="/admin" replace state={{ from: location.pathname }} />;
  }

  if (!isAdmin || !serverVerified) {
    toast.error("Accès refusé : droits administrateur requis.");
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

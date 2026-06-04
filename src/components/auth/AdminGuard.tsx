import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { logAuthEvent } from "@/lib/auth-audit";
import { toast } from "sonner";

interface AdminGuardProps {
  children: React.ReactNode;
}

/**
 * Strict admin guard:
 *  1. Waits for auth to be ready.
 *  2. Redirects unauthenticated users to /admin (login).
 *  3. Calls the `verify-admin` edge function (server-side check using the
 *     service role) as defense-in-depth in addition to the client `isAdmin`.
 *  4. Logs every denial / grant to `auth_audit_log`.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isAdmin, authReady, adminChecking } = useAuth();
  const location = useLocation();
  const [serverVerified, setServerVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (!authReady || adminChecking) return;

    if (!user) {
      logAuthEvent("admin_route_denied", {
        metadata: { reason: "no_session", path: location.pathname },
      });
      setServerVerified(false);
      return;
    }

    if (!isAdmin) {
      logAuthEvent("admin_route_denied", {
        user_id: user.id,
        email: user.email ?? null,
        is_admin: false,
        metadata: { reason: "client_not_admin", path: location.pathname },
      });
      setServerVerified(false);
      return;
    }

    // Client thinks user is admin — double-check on the server.
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
    };
  }, [authReady, adminChecking, user, isAdmin, location.pathname]);

  if (!authReady || adminChecking || verifying || serverVerified === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            Vérification des droits d'accès…
          </p>
        </div>
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

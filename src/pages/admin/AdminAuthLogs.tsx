import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert, ShieldCheck, LogIn, LogOut, RefreshCw, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { AdminGuard } from "@/components/auth/AdminGuard";

interface AuthLog {
  id: string;
  user_id: string | null;
  email: string | null;
  event_type: string;
  is_admin: boolean | null;
  metadata: Record<string, unknown> | null;
  user_agent: string | null;
  created_at: string;
}

const EVENT_ICONS: Record<string, JSX.Element> = {
  sign_in: <LogIn className="h-4 w-4 text-green-600" />,
  sign_out: <LogOut className="h-4 w-4 text-muted-foreground" />,
  token_refreshed: <RefreshCw className="h-4 w-4 text-blue-500" />,
  session_restored: <RefreshCw className="h-4 w-4 text-blue-500" />,
  session_lost: <LogOut className="h-4 w-4 text-muted-foreground" />,
  admin_check: <Eye className="h-4 w-4 text-amber-500" />,
  admin_check_failed: <ShieldAlert className="h-4 w-4 text-destructive" />,
  admin_route_denied: <ShieldAlert className="h-4 w-4 text-destructive" />,
  admin_route_granted: <ShieldCheck className="h-4 w-4 text-green-600" />,
  admin_verified: <ShieldCheck className="h-4 w-4 text-green-600" />,
  admin_denied: <ShieldAlert className="h-4 w-4 text-destructive" />,
};

function AdminAuthLogsContent() {
  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["auth-audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("auth_audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as AuthLog[];
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <div className="container py-8 max-w-5xl">
        <div className="flex items-center justify-between mb-6">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Rafraîchir
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="font-serif">
              Journal d'authentification
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Les 200 derniers événements de session et d'accès admin.
            </p>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-sm text-muted-foreground">Chargement…</div>
            ) : !logs || logs.length === 0 ? (
              <div className="text-sm text-muted-foreground">Aucun événement.</div>
            ) : (
              <div className="space-y-2">
                {logs.map((log) => (
                  <div
                    key={log.id}
                    className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors"
                  >
                    <div className="mt-0.5">
                      {EVENT_ICONS[log.event_type] ?? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{log.event_type}</span>
                        {log.is_admin === true && (
                          <Badge variant="default" className="text-[10px]">admin</Badge>
                        )}
                        {log.is_admin === false && (
                          <Badge variant="secondary" className="text-[10px]">non-admin</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {log.email ?? "anonyme"}
                        {" • "}
                        {new Date(log.created_at).toLocaleString("fr-FR")}
                      </div>
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <pre className="mt-1 text-[11px] text-muted-foreground/80 bg-muted/50 rounded px-2 py-1 overflow-x-auto">
                          {JSON.stringify(log.metadata, null, 0)}
                        </pre>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function AdminAuthLogs() {
  return (
    <AdminGuard>
      <AdminAuthLogsContent />
    </AdminGuard>
  );
}

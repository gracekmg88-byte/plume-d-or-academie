import { Link } from "react-router-dom";
import { ShieldCheck, ExternalLink, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useRecentCertificates } from "@/hooks/useCertificate";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export function CertificationsCard() {
  const { data: certs = [], isLoading } = useRecentCertificates(8);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <div className="space-y-1">
          <CardTitle className="text-base font-serif flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-500" />
            Certifications numériques
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            {certs.length} certificat{certs.length > 1 ? "s" : ""} émis
          </p>
        </div>
        <Award className="h-8 w-8 text-emerald-500/40" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-12 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : certs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun certificat émis pour le moment.
          </p>
        ) : (
          <ul className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {certs.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 hover:bg-accent/30 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{c.publication_title}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="font-mono">{c.certificate_number}</span>
                    <span>•</span>
                    <span>{format(new Date(c.issued_at), "d MMM", { locale: fr })}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    Certifié
                  </Badge>
                  <Link
                    to={`/verify/${c.certificate_number}`}
                    target="_blank"
                    className="p-1 hover:text-primary"
                    title="Vérifier"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

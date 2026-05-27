import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Download, ExternalLink, QrCode, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useCertificate, useGenerateCertificate } from "@/hooks/useCertificate";
import { cn } from "@/lib/utils";

interface Props {
  publicationId: string;
  certificationStatus?: string | null;
}

export function CertificationSection({ publicationId, certificationStatus }: Props) {
  const { isAdmin } = useAuth();
  const { data: cert, isLoading } = useCertificate(publicationId);
  const generate = useGenerateCertificate();
  const [qrOpen, setQrOpen] = useState(false);

  const status = cert ? "certified" : certificationStatus || "not_certified";
  const isCertified = !!cert;
  const isPending = status === "pending" && !cert;

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 md:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          {isCertified ? (
            <ShieldCheck className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : isPending ? (
            <Loader2 className="h-5 w-5 text-amber-500 animate-spin shrink-0" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-muted-foreground shrink-0" />
          )}
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-serif text-base font-semibold text-foreground">
                Certification numérique
              </h3>
              <StatusBadge status={status} />
            </div>
            {cert && (
              <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                {cert.certificate_number}
              </p>
            )}
          </div>
        </div>

        {/* Bouton admin */}
        {isAdmin && !cert && !isLoading && (
          <Button
            size="sm"
            onClick={() => generate.mutate(publicationId)}
            disabled={generate.isPending}
            className="gap-2"
          >
            {generate.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Award className="h-4 w-4" />
            )}
            Générer le certificat
          </Button>
        )}
      </div>

      {/* Actions publiques visibles par tous quand certifié */}
      {cert && (
        <div className="flex flex-wrap gap-2 pt-1">
          {cert.certificate_pdf_url && (
            <Button size="sm" variant="outline" asChild className="gap-2">
              <a href={cert.certificate_pdf_url} target="_blank" rel="noopener noreferrer" download>
                <Download className="h-4 w-4" />
                Télécharger le certificat
              </a>
            </Button>
          )}
          <Button size="sm" variant="outline" asChild className="gap-2">
            <a href={`/verify/${cert.certificate_number}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" />
              Vérifier le certificat
            </a>
          </Button>
          {cert.qr_code_url && (
            <Button size="sm" variant="outline" onClick={() => setQrOpen(true)} className="gap-2">
              <QrCode className="h-4 w-4" />
              QR Code
            </Button>
          )}
        </div>
      )}

      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>QR Code de vérification</DialogTitle>
          </DialogHeader>
          {cert?.qr_code_url && (
            <div className="flex flex-col items-center gap-3">
              <img
                src={cert.qr_code_url}
                alt="QR Code de vérification"
                className="w-64 h-64 rounded-lg border border-border bg-white p-3"
              />
              <p className="text-xs text-muted-foreground text-center font-mono break-all">
                {cert.certificate_number}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    certified: {
      label: "✅ Publication certifiée",
      className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    },
    pending: {
      label: "⏳ En attente",
      className: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
    },
    not_certified: {
      label: "Non certifié",
      className: "bg-muted text-muted-foreground border-border",
    },
  };
  const c = config[status] || config.not_certified;
  return (
    <Badge variant="outline" className={cn("text-xs font-medium", c.className)}>
      {c.label}
    </Badge>
  );
}

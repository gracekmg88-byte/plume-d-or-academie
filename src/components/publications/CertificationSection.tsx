import { useState } from "react";
import { ShieldCheck, ShieldAlert, Loader2, Download, ExternalLink, QrCode, Award, FileText, Calendar, Hash, User, BookOpen, Stamp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { useCertificate, useGenerateCertificate } from "@/hooks/useCertificate";
import { cn } from "@/lib/utils";

interface Props {
  publicationId: string;
  certificationStatus?: string | null;
  publicationTitle?: string;
  publicationAuthor?: string;
  publicationCategory?: string;
  publicationDate?: string;
}

function templateForCategory(cat?: string) {
  const c = (cat || "").toLowerCase();
  if (c === "livre") return { label: "Certificat Premium", subtitle: "Édition Livre", tone: "bg-amber-500/10 text-amber-700 border-amber-500/30" };
  if (c === "memoire" || c === "tfc") return { label: "Certificat Académique", subtitle: "Mémoire / TFC", tone: "bg-blue-500/10 text-blue-700 border-blue-500/30" };
  return { label: "Certificat Standard", subtitle: "Article scientifique", tone: "bg-slate-500/10 text-slate-700 border-slate-500/30" };
}

function categoryLabel(cat?: string) {
  const c = (cat || "").toLowerCase();
  if (c === "livre") return "LIVRE";
  if (c === "memoire") return "MÉMOIRE";
  if (c === "tfc") return "TFC";
  if (c === "article") return "ARTICLE SCIENTIFIQUE";
  return "PUBLICATION";
}

export function CertificationSection({
  publicationId,
  certificationStatus,
  publicationTitle,
  publicationAuthor,
  publicationCategory,
  publicationDate,
}: Props) {
  const { isAdmin } = useAuth();
  const { data: cert, isLoading } = useCertificate(publicationId);
  const generate = useGenerateCertificate();
  const [qrOpen, setQrOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const status = cert ? "certified" : certificationStatus || "not_certified";
  const isCertified = !!cert;
  const isPending = status === "pending" && !cert;
  const tpl = templateForCategory(publicationCategory);

  const handleConfirmGenerate = async () => {
    try {
      await generate.mutateAsync(publicationId);
      setPreviewOpen(false);
    } catch {
      /* toast handled in hook */
    }
  };

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

        {/* Bouton admin — ouvre la prévisualisation */}
        {isAdmin && !cert && !isLoading && (
          <Button
            size="sm"
            onClick={() => setPreviewOpen(true)}
            className="gap-2"
          >
            <Award className="h-4 w-4" />
            Prévisualiser & générer
          </Button>
        )}
      </div>

      {/* Actions publiques */}
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

      {/* QR Dialog */}
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

      {/* Preview Dialog — admin only */}
      <Dialog open={previewOpen} onOpenChange={(o) => !generate.isPending && setPreviewOpen(o)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stamp className="h-5 w-5 text-primary" />
              Prévisualisation du certificat
            </DialogTitle>
            <DialogDescription>
              Vérifiez les informations ci-dessous avant de générer le PDF officiel et son QR code.
            </DialogDescription>
          </DialogHeader>

          {/* Mock certificate preview */}
          <div className="rounded-xl border-4 border-amber-500/60 bg-gradient-to-br from-amber-50/40 via-background to-amber-50/20 dark:from-amber-950/20 dark:to-background p-6 space-y-4">
            <div className="text-center space-y-1">
              <p className="font-serif text-2xl font-bold tracking-wide">PLUME D'OR KMG</p>
              <p className="text-xs italic text-muted-foreground">Bibliothèque Numérique Académique</p>
              <p className="text-[10px] italic text-amber-600 dark:text-amber-400">
                « Diffuser le savoir, valoriser la recherche »
              </p>
            </div>

            <div className="text-center space-y-2 pt-2">
              <p className="font-serif text-lg font-bold text-primary uppercase tracking-wider">
                Certificat de publication
              </p>
              <Badge variant="outline" className={cn("text-[10px]", tpl.tone)}>
                {tpl.label} — {tpl.subtitle}
              </Badge>
              <div className="flex justify-center pt-1">
                <span className="inline-flex items-center gap-2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  ★ {categoryLabel(publicationCategory)} ★
                </span>
              </div>
            </div>

            <div className="text-center space-y-1 pt-2">
              <p className="text-xs text-muted-foreground">Nous certifions que la publication intitulée :</p>
              <p className="font-serif text-lg font-bold leading-tight">
                {publicationTitle || "(titre indisponible)"}
              </p>
              <p className="text-sm italic">par {publicationAuthor || "(auteur inconnu)"}</p>
              <p className="text-xs text-muted-foreground pt-1">
                a été officiellement enregistrée et certifiée dans le registre de Plume d'Or KMG.
              </p>
            </div>

            {/* Pictos info */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-3 text-xs">
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <Hash className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">N° Publication</p>
                  <p className="font-mono truncate">À générer</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <FileText className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">N° Certificat</p>
                  <p className="font-mono truncate">À générer</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <BookOpen className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">Catégorie</p>
                  <p className="truncate">{categoryLabel(publicationCategory)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <Calendar className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">Date publication</p>
                  <p className="truncate">
                    {publicationDate
                      ? new Date(publicationDate).toLocaleDateString("fr-FR")
                      : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <User className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">Auteur</p>
                  <p className="truncate">{publicationAuthor || "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 p-2 rounded-lg bg-background/60 border border-border">
                <QrCode className="h-4 w-4 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-[10px] text-muted-foreground uppercase">QR Code</p>
                  <p className="truncate">Vers la page publique</p>
                </div>
              </div>
            </div>

            {/* Cachet + signature mock */}
            <div className="flex items-end justify-between gap-4 pt-4 border-t border-border/50">
              <div className="text-[10px] text-muted-foreground">
                <p className="font-bold uppercase tracking-wider">Signé numériquement</p>
                <p className="italic">Direction Plume d'Or KMG</p>
                <p>{new Date().toLocaleString("fr-FR")}</p>
              </div>
              <div className="flex flex-col items-center justify-center w-20 h-20 rounded-full border-2 border-amber-500/70 text-amber-700 dark:text-amber-400 text-[8px] font-bold text-center leading-tight">
                <Stamp className="h-4 w-4 mb-0.5" />
                PLUME D'OR
                <br />KMG
                <br />CERTIFIÉ
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            La génération crée définitivement le numéro de publication, le numéro de certificat,
            le QR code et le PDF officiel. Cette action ne peut pas être annulée.
          </p>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
              disabled={generate.isPending}
            >
              Annuler
            </Button>
            <Button
              onClick={handleConfirmGenerate}
              disabled={generate.isPending}
              className="gap-2"
            >
              {generate.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Award className="h-4 w-4" />
              )}
              Confirmer et générer le PDF
            </Button>
          </DialogFooter>
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

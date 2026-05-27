import { useParams, Link } from "react-router-dom";
import { ShieldCheck, ShieldX, Download, ArrowLeft, Calendar, User, Tag, Hash, ExternalLink } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useCertificateByNumber } from "@/hooks/useCertificate";
import { SEO } from "@/components/seo/SEO";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function VerifyCertificate() {
  const { number } = useParams<{ number: string }>();
  const { data: cert, isLoading } = useCertificateByNumber(number);

  return (
    <Layout>
      <SEO
        title={`Vérification certificat ${number ?? ""}`}
        description="Page officielle de vérification d'un certificat de publication Plume d'Or KMG."
        path={`/verify/${number}`}
      />
      <div className="container max-w-3xl py-10 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-8"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à l'accueil
        </Link>

        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-32 bg-muted rounded-xl" />
            <div className="h-64 bg-muted rounded-xl" />
          </div>
        ) : !cert ? (
          <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center space-y-4">
            <ShieldX className="h-14 w-14 text-destructive mx-auto" />
            <h1 className="font-serif text-2xl font-bold text-foreground">
              Certificat introuvable
            </h1>
            <p className="text-muted-foreground">
              Aucun certificat n'a été trouvé avec le numéro <span className="font-mono font-semibold">{number}</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* En-tête validation */}
            <div className="rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 p-6 md:p-8 text-center space-y-3">
              <ShieldCheck className="h-16 w-16 text-emerald-500 mx-auto" />
              <h1 className="font-serif text-2xl md:text-3xl font-bold text-foreground">
                Certificat valide et authentique
              </h1>
              <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/40">
                ✅ Publication certifiée
              </Badge>
              <p className="text-sm text-muted-foreground max-w-xl mx-auto">
                Ce certificat est officiellement enregistré dans le système de certification numérique de Plume d'Or KMG.
              </p>
            </div>

            {/* Détails */}
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 space-y-5">
              <h2 className="font-serif text-xl font-semibold text-foreground border-b border-border pb-3">
                Détails du certificat
              </h2>

              <div className="grid sm:grid-cols-2 gap-4">
                <Info icon={Hash} label="Numéro de certificat" value={cert.certificate_number} mono />
                <Info icon={Hash} label="Numéro de publication" value={cert.publication_number} mono />
                <Info icon={User} label="Auteur" value={cert.publication_author} />
                <Info icon={Tag} label="Catégorie" value={cert.publication_category} />
                <Info
                  icon={Calendar}
                  label="Date de publication"
                  value={format(new Date(cert.publication_date), "d MMMM yyyy", { locale: fr })}
                />
                <Info
                  icon={Calendar}
                  label="Date d'émission"
                  value={format(new Date(cert.issued_at), "d MMMM yyyy", { locale: fr })}
                />
              </div>

              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1">
                  Titre de la publication
                </p>
                <p className="font-serif text-lg font-semibold text-foreground">
                  {cert.publication_title}
                </p>
              </div>
            </div>

            {/* QR + Actions */}
            <div className="grid md:grid-cols-3 gap-6 items-center rounded-2xl border border-border bg-card p-6">
              {cert.qr_code_url && (
                <div className="flex justify-center">
                  <img
                    src={cert.qr_code_url}
                    alt="QR Code"
                    className="w-40 h-40 rounded-lg border border-border bg-white p-2"
                  />
                </div>
              )}
              <div className="md:col-span-2 space-y-3">
                <p className="text-sm text-muted-foreground">
                  Scannez le QR code ou utilisez les liens ci-dessous pour partager ou consulter ce certificat.
                </p>
                <div className="flex flex-wrap gap-2">
                  {cert.certificate_pdf_url && (
                    <Button asChild size="sm" className="gap-2">
                      <a href={cert.certificate_pdf_url} target="_blank" rel="noopener noreferrer" download>
                        <Download className="h-4 w-4" />
                        Télécharger le certificat (PDF)
                      </a>
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline" className="gap-2">
                    <Link to={`/publication/${cert.publication_id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Voir la publication
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

function Info({ icon: Icon, label, value, mono }: { icon: any; label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-1 flex items-center gap-1.5">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </p>
      <p className={mono ? "font-mono text-sm font-semibold text-foreground" : "text-foreground"}>
        {value}
      </p>
    </div>
  );
}

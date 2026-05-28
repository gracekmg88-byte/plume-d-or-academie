import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Search, Download, ExternalLink, ArrowLeft, RefreshCw, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/useAuth";
import { useRecentCertificates, useGenerateCertificate } from "@/hooks/useCertificate";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

export default function AdminCertificates() {
  const { isAdmin, loading } = useAuth();
  const { data: certs = [], isLoading } = useRecentCertificates(500);
  const regenerate = useGenerateCertificate();
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const handleDownload = async (url: string, certNumber: string, id: string) => {
    try {
      setDownloadingId(id);
      const res = await fetch(url);
      if (!res.ok) throw new Error("Téléchargement impossible");
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `${certNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e) {
      toast.error("Échec du téléchargement", {
        description: e instanceof Error ? e.message : "Erreur inconnue",
      });
    } finally {
      setDownloadingId(null);
    }
  };


  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return certs;
    return certs.filter(
      (c) =>
        c.certificate_number.toLowerCase().includes(term) ||
        c.publication_number.toLowerCase().includes(term) ||
        c.publication_title.toLowerCase().includes(term) ||
        c.publication_author.toLowerCase().includes(term)
    );
  }, [certs, q]);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    certs.forEach((c) => {
      map[c.publication_category] = (map[c.publication_category] || 0) + 1;
    });
    return map;
  }, [certs]);

  if (loading) return null;
  if (!isAdmin) {
    return (
      <Layout>
        <div className="container py-20 text-center">
          <p className="text-muted-foreground">Accès réservé aux administrateurs.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <SEO title="Registre des certificats" description="Registre officiel des certifications" path="/admin/certificates" />
      <div className="container py-8 md:py-12 space-y-6">
        <Link to="/admin/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-emerald-500" />
          <div>
            <h1 className="font-serif text-2xl md:text-3xl font-bold">Registre des certificats</h1>
            <p className="text-sm text-muted-foreground">{certs.length} certificat{certs.length > 1 ? "s" : ""} émis</p>
          </div>
        </div>

        {/* Stats par catégorie */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {["livre", "memoire", "tfc", "article"].map((cat) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{cat}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{byCategory[cat] || 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recherche */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par numéro, titre ou auteur…"
            className="pl-10"
          />
        </div>

        {/* Liste */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-muted-foreground">Chargement…</div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">Aucun certificat trouvé.</div>
            ) : (
              <ul className="divide-y divide-border">
                {filtered.map((c) => (
                  <li key={c.id} className="p-4 flex items-start justify-between gap-3 hover:bg-accent/30">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{c.publication_title}</p>
                      <p className="text-xs text-muted-foreground truncate">par {c.publication_author}</p>
                      <div className="flex flex-wrap gap-1.5 mt-1.5 items-center text-xs">
                        <Badge variant="outline" className="font-mono text-[10px]">{c.certificate_number}</Badge>
                        <Badge variant="outline" className="font-mono text-[10px]">{c.publication_number}</Badge>
                        <Badge variant="outline" className="text-[10px] capitalize">{c.publication_category}</Badge>
                        <span className="text-muted-foreground">
                          • {format(new Date(c.issued_at), "d MMM yyyy", { locale: fr })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {c.certificate_pdf_url ? (
                        <Button
                          size="icon"
                          variant="ghost"
                          title="Télécharger le PDF"
                          disabled={downloadingId === c.id}
                          onClick={() => handleDownload(c.certificate_pdf_url!, c.certificate_number, c.id)}
                        >
                          {downloadingId === c.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Download className="h-4 w-4" />
                          )}
                        </Button>
                      ) : null}
                      <Button
                        size="icon"
                        variant="ghost"
                        title={c.certificate_pdf_url ? "Régénérer le PDF" : "Générer le PDF"}
                        disabled={regenerate.isPending}
                        onClick={() =>
                          regenerate.mutate({ publicationId: c.publication_id, regenerate: true })
                        }
                      >
                        {regenerate.isPending && regenerate.variables &&
                        typeof regenerate.variables === "object" &&
                        regenerate.variables.publicationId === c.publication_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                      </Button>
                      <Button size="icon" variant="ghost" asChild title="Vérifier">
                        <Link to={`/verify/${c.certificate_number}`} target="_blank">
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    </div>

                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

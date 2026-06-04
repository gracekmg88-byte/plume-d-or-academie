import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Search, QrCode, Loader2 } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SEO } from "@/components/seo/SEO";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function VerifyHome() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    try {
      // Recherche par numéro de certificat OU de publication
      const { data, error } = await supabase
        .from("certificates")
        .select("certificate_number, publication_number")
        .or(`certificate_number.eq.${q},publication_number.eq.${q}`)
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        toast.error("Aucun certificat trouvé", { description: q });
        return;
      }
      navigate(`/verify/${data.certificate_number}`);
    } catch (err: any) {
      toast.error("Erreur de recherche", { description: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <SEO
        title="Vérification de certificat — KMG Bibliothèque"
        description="Vérifiez l'authenticité d'une publication certifiée par KMG Bibliothèque via son numéro ou QR code."
        path="/verification"
      />
      <div className="container max-w-2xl py-12 md:py-20">
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/15 mb-2">
            <ShieldCheck className="h-9 w-9 text-emerald-500" />
          </div>
          <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
            Vérification de certificat
          </h1>
          <p className="text-muted-foreground max-w-md mx-auto">
            Saisissez un numéro de certificat (ex. <span className="font-mono">CERT-2026-001</span>) ou
            de publication (ex. <span className="font-mono">KMG-ART-2026-001</span>) pour vérifier son authenticité.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value.toUpperCase())}
              placeholder="CERT-2026-001 ou KMG-ART-2026-001"
              className="pl-10 font-mono"
              autoFocus
            />
          </div>
          <Button type="submit" disabled={loading || !query.trim()} className="gap-2">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Vérifier
          </Button>
        </form>

        <div className="mt-10 grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-border bg-card/50 p-5 space-y-2">
            <QrCode className="h-6 w-6 text-primary" />
            <h3 className="font-semibold text-foreground">Scanner un QR Code</h3>
            <p className="text-sm text-muted-foreground">
              Chaque certificat contient un QR code qui ouvre directement la page de vérification publique.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card/50 p-5 space-y-2">
            <ShieldCheck className="h-6 w-6 text-emerald-500" />
            <h3 className="font-semibold text-foreground">Registre officiel</h3>
            <p className="text-sm text-muted-foreground">
              Tous les certificats émis sont conservés de manière permanente et publiquement vérifiables.
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

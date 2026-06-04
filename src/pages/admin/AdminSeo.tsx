import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Send, ShieldCheck, ArrowLeft, ExternalLink, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface StatusResp {
  ok: boolean;
  status: number;
  sitemap?: any;
  siteUrl: string;
  sitemapUrl: string;
}

export default function AdminSeo() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<StatusResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/admin");
  }, [loading, user, isAdmin, navigate]);

  const call = async (action: string, successMsg?: string) => {
    setBusy(action);
    try {
      const { data: resp, error } = await supabase.functions.invoke("gsc-admin", { body: { action } });
      if (error) throw error;
      if (action === "status") setData(resp as StatusResp);
      if (successMsg) toast.success(successMsg);
      if (action !== "status") await refresh();
      return resp;
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally {
      setBusy(null);
    }
  };

  const refresh = () => call("status");

  useEffect(() => {
    if (user && isAdmin) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const sm = data?.sitemap;
  const webContent = Array.isArray(sm?.contents) ? sm.contents.find((c: any) => c.type === "web") : null;
  const submitted = Number(webContent?.submitted ?? 0);
  const indexed = Number(webContent?.indexed ?? 0);
  const lastSubmitted = sm?.lastSubmitted ? new Date(sm.lastSubmitted).toLocaleString("fr-FR") : "—";
  const lastDownloaded = sm?.lastDownloaded ? new Date(sm.lastDownloaded).toLocaleString("fr-FR") : "—";
  const isPending = data?.status === 404;
  const hasErrors = sm?.errors > 0 || sm?.warnings > 0;
  const indexationRate = submitted > 0 ? Math.round((indexed / submitted) * 100) : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Button>
          </Link>
          <h1 className="text-xl font-bold">SEO & Indexation Google</h1>
          <Button variant="outline" size="sm" className="ml-auto" onClick={refresh} disabled={busy === "status"}>
            {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2 hidden sm:inline">Actualiser</span>
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sitemap dynamique
              {isPending ? (
                <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Non soumis</Badge>
              ) : data?.ok ? (
                <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Soumis</Badge>
              ) : (
                <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erreur</Badge>
              )}
            </CardTitle>
            <CardDescription className="break-all">
              <a href={data?.sitemapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {data?.sitemapUrl} <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Stat label="URLs découvertes" value={submitted.toString()} />
              <Stat label="URLs indexées" value={indexed.toString()} />
              <Stat label="Taux d'indexation" value={`${indexationRate}%`} />
              <Stat label="Erreurs / Warnings" value={`${sm?.errors ?? 0} / ${sm?.warnings ?? 0}`} highlight={hasErrors} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-muted-foreground">
              <div><span className="font-medium text-foreground">Dernière soumission:</span> {lastSubmitted}</div>
              <div><span className="font-medium text-foreground">Dernier téléchargement Google:</span> {lastDownloaded}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => call("submit", "Sitemap soumis à Google")} disabled={!!busy}>
                {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">Soumettre maintenant</span>
              </Button>
              <Button variant="outline" onClick={() => call("verify", "Propriété vérifiée")} disabled={!!busy}>
                {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span className="ml-2">Vérifier la propriété</span>
              </Button>
              <Button variant="outline" onClick={() => call("add_site", "Site ajouté à Search Console")} disabled={!!busy}>
                Ajouter le site à GSC
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Soumission automatique</CardTitle>
            <CardDescription>
              À chaque création ou mise à jour d'une publication, le sitemap est automatiquement re-soumis à Google Search Console pour accélérer l'indexation.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Délai habituel d'indexation après soumission: <span className="text-foreground font-medium">3 à 14 jours</span>.</p>
            <p>Pour forcer l'indexation d'un livre précis, ouvrez Google Search Console → Inspection d'URL → Demander l'indexation.</p>
            <a
              href="https://search.google.com/search-console"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
            >
              Ouvrir Google Search Console <ExternalLink className="h-3 w-3" />
            </a>
          </CardContent>
        </Card>

        {sm && !isPending && (
          <Card>
            <CardHeader><CardTitle className="text-base">Réponse Google brute</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-64">{JSON.stringify(sm, null, 2)}</pre>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${highlight ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, RefreshCw, Send, ShieldCheck, ArrowLeft, ExternalLink, CheckCircle2, XCircle, AlertCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface GscResp {
  action: string;
  ok: boolean;
  status: number;
  sitemap?: any;
  steps?: { verify?: any; addSite?: any; submit?: any };
  siteUrl: string;
  sitemapUrl: string;
}

const POLL_MS = 30_000;

export default function AdminSeo() {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<GscResp | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [autoRan, setAutoRan] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) navigate("/admin");
  }, [loading, user, isAdmin, navigate]);

  const call = async (action: string, successMsg?: string): Promise<GscResp | null> => {
    setBusy(action);
    try {
      const { data: resp, error } = await supabase.functions.invoke("gsc-admin", { body: { action } });
      if (error) throw error;
      const r = resp as GscResp;
      if (action === "status" || action === "onboard" || action === "auto") setData(r);
      setLastChecked(new Date());
      if (successMsg) toast.success(successMsg);
      if (action !== "status" && action !== "onboard" && action !== "auto") {
        await call("status");
      }
      return r;
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
      return null;
    } finally {
      setBusy(null);
    }
  };

  // Initial load + auto-onboard if not yet verified/submitted
  useEffect(() => {
    if (!user || !isAdmin || autoRan) return;
    setAutoRan(true);
    (async () => {
      const status = await call("status");
      const needsOnboard = !status || status.status === 404 || !status.ok;
      if (needsOnboard) {
        toast.info("Vérification automatique de la propriété en cours…");
        const r = await call("onboard");
        if (r?.steps?.verify?.ok) toast.success("Propriété Google vérifiée et sitemap soumis");
        else if (r) toast.warning("Vérification automatique incomplète — voir le détail ci-dessous");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin]);

  // Real-time polling every 30s
  useEffect(() => {
    if (!user || !isAdmin) return;
    pollRef.current = setInterval(() => {
      if (!busy) void call("status");
    }, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isAdmin, busy]);

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
  const sitemapKnown = data?.status === 200;
  const sitemapPending = data?.status === 404;
  const hasErrors = (sm?.errors ?? 0) > 0 || (sm?.warnings ?? 0) > 0;
  const indexationRate = submitted > 0 ? Math.round((indexed / submitted) * 100) : 0;
  const verifyStep = data?.steps?.verify;
  const verifyKnown = verifyStep !== undefined;
  const verifyOk = verifyStep?.ok === true;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/50 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard">
            <Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-2" />Dashboard</Button>
          </Link>
          <h1 className="text-xl font-bold">SEO & Indexation Google</h1>
          <div className="ml-auto flex items-center gap-2">
            {lastChecked && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                MAJ {lastChecked.toLocaleTimeString("fr-FR")}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => call("status")} disabled={!!busy}>
              {busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Actualiser</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6 max-w-4xl">
        {/* Verification status banner */}
        <Card className={verifyOk ? "border-green-500/40" : verifyKnown ? "border-amber-500/40" : ""}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Vérification de la propriété
              {busy === "onboard" || busy === "verify" ? (
                <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Vérification…</Badge>
              ) : verifyOk ? (
                <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Vérifié</Badge>
              ) : sitemapKnown ? (
                <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Vérifié</Badge>
              ) : verifyKnown ? (
                <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Non vérifié</Badge>
              ) : (
                <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Inconnu</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Site : <span className="font-mono">{data?.siteUrl ?? "—"}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!verifyOk && !sitemapKnown && verifyKnown && (
              <p className="text-sm text-amber-600 dark:text-amber-400">
                Google n'a pas pu vérifier la balise meta. Assurez-vous que le site est publié, puis relancez.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => call("onboard", "Onboarding GSC terminé")} disabled={!!busy}>
                {busy === "onboard" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                <span className="ml-2">Vérifier + soumettre (auto)</span>
              </Button>
              <Button variant="outline" onClick={() => call("verify", "Vérification lancée")} disabled={!!busy}>
                {busy === "verify" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                <span className="ml-2">Vérifier seulement</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sitemap status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Sitemap dynamique
              {sitemapPending ? (
                <Badge variant="secondary"><AlertCircle className="h-3 w-3 mr-1" />Non soumis</Badge>
              ) : sitemapKnown ? (
                <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Soumis</Badge>
              ) : (
                <Badge variant="secondary">…</Badge>
              )}
            </CardTitle>
            <CardDescription className="break-all">
              <a href={data?.sitemapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {data?.sitemapUrl ?? "—"} <ExternalLink className="h-3 w-3" />
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
              <div><span className="font-medium text-foreground">Dernière soumission :</span> {lastSubmitted}</div>
              <div><span className="font-medium text-foreground">Dernier téléchargement Google :</span> {lastDownloaded}</div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button onClick={() => call("submit", "Sitemap soumis à Google")} disabled={!!busy}>
                {busy === "submit" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="ml-2">Soumettre maintenant</span>
              </Button>
              <Button variant="outline" onClick={() => call("add_site", "Site ajouté à GSC")} disabled={!!busy}>
                Ajouter le site
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Soumission automatique</CardTitle>
            <CardDescription>
              À chaque création ou mise à jour d'une publication, le sitemap est automatiquement re-soumis à Google Search Console.
              La vérification de propriété est aussi tentée automatiquement à l'ouverture de cette page.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>Délai habituel d'indexation après soumission : <span className="text-foreground font-medium">3 à 14 jours</span>.</p>
            <p>Rafraîchissement temps réel : toutes les 30 secondes.</p>
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

        {(sm || data?.steps) && (
          <Card>
            <CardHeader><CardTitle className="text-base">Détail technique</CardTitle></CardHeader>
            <CardContent>
              <pre className="text-xs bg-muted/50 rounded p-3 overflow-auto max-h-80">
{JSON.stringify({ steps: data?.steps, sitemap: sm }, null, 2)}
              </pre>
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

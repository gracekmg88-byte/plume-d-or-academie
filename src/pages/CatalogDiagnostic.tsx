import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, CheckCircle2, Loader2, RefreshCw, Radio, ShieldCheck } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { SEO } from "@/components/seo/SEO";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";

type DiagnosticResult = {
  publishedCount: number;
  publicReadOk: boolean;
  sampleCount: number;
  summary: string;
  detail: string;
  errorCode?: string;
  errorMessage?: string;
};

function StatusRow({
  title,
  value,
  tone = "default",
  icon: Icon,
}: {
  title: string;
  value: string;
  tone?: "default" | "success" | "warning";
  icon: typeof CheckCircle2;
}) {
  const toneClass =
    tone === "success"
      ? "border-primary/30 bg-primary/10"
      : tone === "warning"
        ? "border-destructive/30 bg-destructive/10"
        : "border-border bg-card";

  return (
    <div className={`rounded-lg border p-4 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-md bg-background/70 p-2">
          <Icon className="h-4 w-4 text-foreground" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function CatalogDiagnostic() {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<"connecting" | "active" | "error">("connecting");
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<string | null>(null);

  const copy = useMemo(
    () =>
      language === "fr"
        ? {
            title: "Diagnostic du catalogue",
            description:
              "Cette page vérifie automatiquement si le catalogue public peut lire les publications et explique pourquoi la bibliothèque peut sembler vide.",
            verdict: "Verdict",
            published: "Publications publiées",
            publicRead: "Lecture publique",
            realtime: "Mise à jour automatique",
            lastEvent: "Dernier événement reçu",
            active: "Active",
            connecting: "Connexion en cours",
            unavailable: "Indisponible",
            refresh: "Relancer le diagnostic",
            openLibrary: "Ouvrir la bibliothèque",
            sampleOk: "Le catalogue public renvoie bien des éléments publiés.",
            sampleEmpty: "La requête publique répond mais ne renvoie aucun élément publié.",
            readOk: "Les permissions de lecture publique fonctionnent.",
            readBlocked: "La lecture publique du catalogue est bloquée.",
            realtimeDetail: "Le site écoute maintenant les publications et se met à jour automatiquement après publication, modification ou suppression.",
            technical: "Détail technique",
          }
        : {
            title: "Catalogue diagnostic",
            description:
              "This page automatically checks whether the public catalogue can read publications and explains why the library may appear empty.",
            verdict: "Verdict",
            published: "Published publications",
            publicRead: "Public read access",
            realtime: "Automatic refresh",
            lastEvent: "Last event received",
            active: "Active",
            connecting: "Connecting",
            unavailable: "Unavailable",
            refresh: "Run diagnostic again",
            openLibrary: "Open library",
            sampleOk: "The public catalogue is returning published items.",
            sampleEmpty: "The public query responds but returns no published items.",
            readOk: "Public read permissions are working.",
            readBlocked: "Public catalogue read access is blocked.",
            realtimeDetail: "The site now listens for publication changes and refreshes automatically after publish, edit, or delete.",
            technical: "Technical detail",
          },
    [language],
  );

  const runDiagnostic = useCallback(async () => {
    setRefreshing(true);

    const countProbe = await supabase
      .from("publications")
      .select("id", { count: "exact", head: true })
      .eq("is_published", true);

    const sampleProbe = await supabase
      .from("publications")
      .select("id, title, updated_at")
      .eq("is_published", true)
      .order("updated_at", { ascending: false })
      .limit(3);

    const publicReadOk = !countProbe.error && !sampleProbe.error;
    const publishedCount = countProbe.count ?? 0;
    const sampleCount = sampleProbe.data?.length ?? 0;

    let summary = copy.readOk;
    let detail = copy.sampleOk;

    if (!publicReadOk) {
      summary = copy.readBlocked;
      detail = countProbe.error?.message || sampleProbe.error?.message || copy.unavailable;
    } else if (publishedCount === 0) {
      summary = copy.sampleEmpty;
      detail = language === "fr"
        ? "Aucune publication n'est marquée comme publiée pour l'instant."
        : "No publication is currently marked as published.";
    } else if (sampleCount === 0) {
      summary = copy.sampleEmpty;
      detail = language === "fr"
        ? "Le comptage renvoie des publications, mais la requête détaillée ne retourne rien."
        : "The count query finds publications, but the detailed fetch returns no rows.";
    } else {
      summary = language === "fr"
        ? "Le catalogue public est accessible. Si la bibliothèque a déjà affiché une liste vide, c'était un incident de chargement, de cache ou de permissions temporaires."
        : "The public catalogue is accessible. If the library previously showed an empty list, it was likely caused by loading, cache, or temporary permission issues.";
      detail = copy.realtimeDetail;
    }

    setResult({
      publishedCount,
      publicReadOk,
      sampleCount,
      summary,
      detail,
      errorCode: countProbe.error?.code || sampleProbe.error?.code,
      errorMessage: countProbe.error?.message || sampleProbe.error?.message,
    });

    setLoading(false);
    setRefreshing(false);
  }, [copy, language]);

  useEffect(() => {
    void runDiagnostic();
  }, [runDiagnostic]);

  useEffect(() => {
    const channel = supabase
      .channel("catalog-diagnostic-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "publications" },
        () => {
          setLastRealtimeEvent(new Date().toLocaleString(language === "fr" ? "fr-FR" : "en-US"));
          setRealtimeStatus("active");
          void runDiagnostic();
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setRealtimeStatus("active");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setRealtimeStatus("error");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [language, runDiagnostic]);

  return (
    <Layout>
      <SEO
        title="Diagnostic catalogue — KMG"
        description="Vérification automatique de l’accès public au catalogue, des publications publiées et de la mise à jour immédiate de la bibliothèque."
        path="/diagnostic-catalogue"
      />

      <section className="py-12 md:py-16">
        <div className="container max-w-4xl space-y-8">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1 text-sm text-muted-foreground">
              <ShieldCheck className="h-4 w-4" />
              <span>{copy.title}</span>
            </div>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">{copy.title}</h1>
            <p className="max-w-2xl text-muted-foreground">{copy.description}</p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <StatusRow
              title={copy.publicRead}
              value={
                result
                  ? result.publicReadOk
                    ? copy.readOk
                    : result.errorMessage || copy.readBlocked
                  : copy.connecting
              }
              tone={result ? (result.publicReadOk ? "success" : "warning") : "default"}
              icon={result?.publicReadOk ? CheckCircle2 : AlertTriangle}
            />
            <StatusRow
              title={copy.published}
              value={loading && !result ? copy.connecting : `${result?.publishedCount ?? 0}`}
              tone={result && (result.publishedCount ?? 0) > 0 ? "success" : "default"}
              icon={Activity}
            />
            <StatusRow
              title={copy.realtime}
              value={
                realtimeStatus === "active"
                  ? copy.active
                  : realtimeStatus === "error"
                    ? copy.unavailable
                    : copy.connecting
              }
              tone={realtimeStatus === "active" ? "success" : realtimeStatus === "error" ? "warning" : "default"}
              icon={Radio}
            />
            <StatusRow
              title={copy.lastEvent}
              value={lastRealtimeEvent || "—"}
              tone="default"
              icon={RefreshCw}
            />
          </div>

          <div className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{copy.verdict}</p>
                {loading && !result ? (
                  <div className="flex items-center gap-2 text-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{copy.connecting}</span>
                  </div>
                ) : (
                  <>
                    <h2 className="text-xl font-semibold text-foreground">{result?.summary}</h2>
                    <p className="text-muted-foreground">{result?.detail}</p>
                    {(result?.errorCode || result?.errorMessage) && (
                      <p className="text-sm text-muted-foreground">
                        {copy.technical}: {result?.errorCode || "—"} {result?.errorMessage ? `— ${result.errorMessage}` : ""}
                      </p>
                    )}
                  </>
                )}
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Button onClick={() => void runDiagnostic()} disabled={refreshing}>
                  {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                  {copy.refresh}
                </Button>
                <Button asChild variant="outline">
                  <Link to="/bibliotheque">{copy.openLibrary}</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </Layout>
  );
}
import { BookOpen, Clock, BarChart3, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useReadingHistory } from "@/hooks/useReadingHistory";
import { useLanguage } from "@/contexts/LanguageContext";
import { Link, useLocation } from "react-router-dom";
import { getCurrentHistoryEntryKey, saveScrollPosition } from "@/lib/scroll-restoration";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

const categoryLabels: Record<string, Record<string, string>> = {
  fr: { livre: "Livres", memoire: "Mémoires", tfc: "TFC", article: "Articles" },
  en: { livre: "Books", memoire: "Theses", tfc: "Papers", article: "Articles" },
};

function formatDuration(seconds: number, lang: string): string {
  if (seconds < 60) return lang === "fr" ? `${seconds}s` : `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    const remainMins = mins % 60;
    return `${hrs}h ${remainMins}min`;
  }
  return `${mins}min`;
}

export function ReadingStatsCard() {
  const { stats, isLoading } = useReadingHistory();
  const { language } = useLanguage();
  const { pathname } = useLocation();

  const saveScroll = () => {
    saveScrollPosition(getCurrentHistoryEntryKey(), pathname, window.scrollY);
  };

  if (isLoading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {language === "fr" ? "Statistiques de lecture" : "Reading Statistics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-20 bg-muted rounded-lg" />
            </div>
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalPublications === 0) {
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {language === "fr" ? "Statistiques de lecture" : "Reading Statistics"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {language === "fr"
                ? "Aucune lecture enregistrée. Explorez la bibliothèque !"
                : "No reading activity yet. Explore the library!"}
            </p>
            <Link
              to="/bibliotheque"
              className="text-sm text-primary hover:underline mt-2 inline-block"
            >
              {language === "fr" ? "Parcourir la bibliothèque →" : "Browse the library →"}
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const labels = categoryLabels[language] || categoryLabels.fr;

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          {language === "fr" ? "Statistiques de lecture" : "Reading Statistics"}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalPublications}</p>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Publications lues" : "Publications read"}
            </p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">
              {formatDuration(stats.totalReadingTime, language)}
            </p>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Temps de lecture" : "Reading time"}
            </p>
          </div>
        </div>

        {/* Category breakdown */}
        {Object.keys(stats.categoryBreakdown).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              {language === "fr" ? "Par catégorie" : "By category"}
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.categoryBreakdown).map(([cat, count]) => (
                <div
                  key={cat}
                  className="bg-muted/50 rounded-full px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {labels[cat] || cat}: {count}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly activity chart */}
        {stats.weeklyActivity.some((d) => d.count > 0) && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              {language === "fr" ? "Activité cette semaine" : "This week's activity"}
            </h4>
            <div className="h-24">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.weeklyActivity}>
                  <XAxis
                    dataKey="day"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  />
                  <YAxis hide allowDecimals={false} />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Recent reads */}
        {stats.recentReads.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              {language === "fr" ? "Dernières lectures" : "Recent reads"}
            </h4>
            <div className="space-y-2">
              {stats.recentReads.slice(0, 5).map((r) => (
                <Link
                  key={r.publication_id}
                  to={`/publication/${r.publication_id}`}
                  state={{
                    returnTo: `${pathname}${window.location.search}`,
                    returnKey: window.history.state?.key ?? null,
                    returnPublicationId: r.publication_id,
                  }}
                  data-publication-card-id={r.publication_id}
                  onPointerDown={saveScroll}
                  onClickCapture={saveScroll}
                  className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5 hover:bg-muted transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">{r.author}</p>
                  </div>
                  {r.reading_duration_seconds > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDuration(r.reading_duration_seconds, language)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

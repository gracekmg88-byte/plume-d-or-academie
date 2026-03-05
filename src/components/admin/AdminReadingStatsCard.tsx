import { BookOpen, Clock, BarChart3, TrendingUp, Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAdminReadingStats } from "@/hooks/useAdminReadingStats";
import { Bar, BarChart, XAxis, YAxis, ResponsiveContainer } from "recharts";

const categoryLabels: Record<string, string> = {
  livre: "Livres",
  memoire: "Mémoires",
  tfc: "TFC",
  article: "Articles",
};

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const hrs = Math.floor(mins / 60);
  if (hrs > 0) {
    return `${hrs}h ${mins % 60}min`;
  }
  return `${mins}min`;
}

export function AdminReadingStatsCard() {
  const { stats, isLoading } = useAdminReadingStats();

  if (isLoading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Statistiques de lecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-20 bg-muted rounded-lg" />
              <div className="h-20 bg-muted rounded-lg" />
            </div>
            <div className="h-32 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats || stats.totalSessions === 0) {
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Statistiques de lecture
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-6">
            <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              Aucune session de lecture enregistrée pour le moment.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Statistiques de lecture
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.uniqueReaders}</p>
            <p className="text-xs text-muted-foreground">Lecteurs</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <Clock className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">
              {formatDuration(stats.totalReadingTime)}
            </p>
            <p className="text-xs text-muted-foreground">Temps total</p>
          </div>
        </div>

        {/* Category breakdown */}
        {Object.keys(stats.categoryBreakdown).length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-primary" />
              Par catégorie
            </h4>
            <div className="flex flex-wrap gap-2">
              {Object.entries(stats.categoryBreakdown).map(([cat, count]) => (
                <div
                  key={cat}
                  className="bg-muted/50 rounded-full px-3 py-1.5 text-xs font-medium text-foreground"
                >
                  {categoryLabels[cat] || cat}: {count}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weekly activity chart */}
        {stats.weeklyActivity.some((d) => d.count > 0) && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Activité cette semaine
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

        {/* Top publications */}
        {stats.topPublications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">
              Publications les plus lues
            </h4>
            <div className="space-y-2">
              {stats.topPublications.map((p) => (
                <div
                  key={p.publication_id}
                  className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1 mr-3">
                    <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.author}</p>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {p.sessions} session{p.sessions > 1 ? "s" : ""}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

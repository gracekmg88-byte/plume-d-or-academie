import { Users, BookOpen, Eye, BarChart3, TrendingUp, Award } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalAdminStats } from "@/hooks/useGlobalAdminStats";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts";

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent-foreground))",
  "hsl(142, 71%, 45%)",
  "hsl(262, 83%, 58%)",
];

export function GlobalStatsCard() {
  const { data: stats, isLoading } = useGlobalAdminStats();

  if (isLoading) {
    return (
      <Card className="shadow-elegant">
        <CardHeader>
          <CardTitle className="font-serif text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            Vue d'ensemble
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-muted rounded-lg" />
              ))}
            </div>
            <div className="h-48 bg-muted rounded-lg" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  return (
    <Card className="shadow-elegant">
      <CardHeader>
        <CardTitle className="font-serif text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-primary" />
          Vue d'ensemble
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Key metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <Users className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalUsers}</p>
            <p className="text-xs text-muted-foreground">Utilisateurs</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <BookOpen className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.publishedCount}</p>
            <p className="text-xs text-muted-foreground">Publications</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <Eye className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalViews}</p>
            <p className="text-xs text-muted-foreground">Consultations</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-4 text-center">
            <TrendingUp className="h-5 w-5 text-primary mx-auto mb-1" />
            <p className="text-2xl font-bold text-foreground">{stats.totalReadingSessions}</p>
            <p className="text-xs text-muted-foreground">Sessions lecture</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Category distribution */}
          {stats.categoryDistribution.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Répartition par catégorie
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.categoryDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={40}
                      outerRadius={70}
                      dataKey="count"
                      nameKey="category"
                      paddingAngle={3}
                    >
                      {stats.categoryDistribution.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {stats.categoryDistribution.map((cat, i) => (
                  <div key={cat.category} className="flex items-center gap-1.5 text-xs">
                    <span
                      className="block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: COLORS[i % COLORS.length] }}
                    />
                    {cat.category} ({cat.count})
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Signups chart */}
          {stats.recentSignups.some((d) => d.count > 0) && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">
                Inscriptions (14 derniers jours)
              </h4>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.recentSignups}>
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }}
                      interval={1}
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
        </div>

        {/* Top publications */}
        {stats.topPublications.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
              <Award className="h-4 w-4 text-primary" />
              Publications les plus consultées
            </h4>
            <div className="space-y-2">
              {stats.topPublications.map((p, i) => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 bg-muted/50 rounded-lg px-3 py-2.5"
                >
                  <span className="text-xs font-bold text-primary w-5 text-center">
                    #{i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{p.title}</p>
                    <p className="text-xs text-muted-foreground">{p.author}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                    <Eye className="h-3 w-3" />
                    {p.views_count}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

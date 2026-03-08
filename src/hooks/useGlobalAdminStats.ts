import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GlobalAdminStats {
  totalUsers: number;
  totalPublications: number;
  publishedCount: number;
  totalViews: number;
  totalReadingSessions: number;
  categoryDistribution: Array<{ category: string; count: number }>;
  topPublications: Array<{ id: string; title: string; author: string; views_count: number }>;
  recentSignups: Array<{ date: string; count: number }>;
}

const categoryLabels: Record<string, string> = {
  livre: "Livres",
  memoire: "Mémoires",
  tfc: "TFC",
  article: "Articles",
};

export function useGlobalAdminStats() {
  return useQuery<GlobalAdminStats>({
    queryKey: ["global-admin-stats"],
    queryFn: async () => {
      // Parallel fetches
      const [usersRes, pubsRes, historyRes] = await Promise.all([
        supabase.from("user_profiles").select("created_at", { count: "exact" }),
        supabase.from("publications").select("id, title, author, category, views_count, is_published").order("views_count", { ascending: false }),
        supabase.from("reading_history").select("id", { count: "exact" }),
      ]);

      const totalUsers = usersRes.count || 0;
      const publications = pubsRes.data || [];
      const totalReadingSessions = historyRes.count || 0;

      const publishedCount = publications.filter((p) => p.is_published).length;
      const totalViews = publications.reduce((s, p) => s + p.views_count, 0);

      // Category distribution
      const catMap = new Map<string, number>();
      for (const p of publications) {
        if (p.is_published) {
          catMap.set(p.category, (catMap.get(p.category) || 0) + 1);
        }
      }
      const categoryDistribution = [...catMap.entries()].map(([category, count]) => ({
        category: categoryLabels[category] || category,
        count,
      }));

      // Top 5 publications
      const topPublications = publications
        .filter((p) => p.is_published)
        .slice(0, 5)
        .map((p) => ({ id: p.id, title: p.title, author: p.author, views_count: p.views_count }));

      // Recent signups (last 14 days)
      const recentSignups: Array<{ date: string; count: number }> = [];
      const profiles = usersRes.data || [];
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStr = d.toISOString().split("T")[0];
        const count = profiles.filter((p) => p.created_at.startsWith(dayStr)).length;
        recentSignups.push({
          date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
          count,
        });
      }

      return {
        totalUsers,
        totalPublications: publications.length,
        publishedCount,
        totalViews,
        totalReadingSessions,
        categoryDistribution,
        topPublications,
        recentSignups,
      };
    },
  });
}

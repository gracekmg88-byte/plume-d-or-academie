import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminReadingStats {
  totalSessions: number;
  totalReadingTime: number;
  uniqueReaders: number;
  categoryBreakdown: Record<string, number>;
  weeklyActivity: Array<{ day: string; count: number }>;
  topPublications: Array<{
    publication_id: string;
    title: string;
    author: string;
    sessions: number;
  }>;
}

export function useAdminReadingStats() {
  const { data: stats, isLoading } = useQuery<AdminReadingStats>({
    queryKey: ["admin-reading-stats"],
    queryFn: async () => {
      const { data: history, error } = await supabase
        .from("reading_history")
        .select("*")
        .order("started_at", { ascending: false });

      if (error) throw error;

      const records = history || [];

      // Unique readers
      const uniqueReaders = new Set(records.map((r) => r.user_id)).size;

      // Get publication details
      const uniquePubIds = [...new Set(records.map((r) => r.publication_id))];
      let publications: any[] = [];
      if (uniquePubIds.length > 0) {
        const { data: pubs } = await supabase
          .from("publications")
          .select("id, title, author, category")
          .in("id", uniquePubIds);
        publications = pubs || [];
      }

      const pubMap = new Map(publications.map((p: any) => [p.id, p]));

      // Category breakdown
      const categoryBreakdown: Record<string, number> = {};
      for (const pubId of uniquePubIds) {
        const pub = pubMap.get(pubId);
        if (pub) {
          const sessionsForPub = records.filter((r) => r.publication_id === pubId).length;
          categoryBreakdown[pub.category] = (categoryBreakdown[pub.category] || 0) + sessionsForPub;
        }
      }

      // Total reading time
      const totalReadingTime = records.reduce(
        (sum, r) => sum + (r.reading_duration_seconds || 0), 0
      );

      // Top publications by session count
      const pubSessionCount = new Map<string, number>();
      for (const r of records) {
        pubSessionCount.set(r.publication_id, (pubSessionCount.get(r.publication_id) || 0) + 1);
      }
      const topPublications = [...pubSessionCount.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([pubId, sessions]) => {
          const pub = pubMap.get(pubId);
          return {
            publication_id: pubId,
            title: pub?.title || "Inconnue",
            author: pub?.author || "",
            sessions,
          };
        });

      // Weekly activity (last 7 days)
      const weeklyActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split("T")[0];
        const count = records.filter((r) => r.started_at.startsWith(dayStr)).length;
        weeklyActivity.push({
          day: date.toLocaleDateString("fr-FR", { weekday: "short" }),
          count,
        });
      }

      return {
        totalSessions: records.length,
        totalReadingTime,
        uniqueReaders,
        categoryBreakdown,
        weeklyActivity,
        topPublications,
      };
    },
  });

  return { stats, isLoading };
}

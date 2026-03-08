import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

interface ReadingRecord {
  id: string;
  user_id: string;
  publication_id: string;
  started_at: string;
  reading_duration_seconds: number;
  created_at: string;
}

interface ReadingStats {
  totalPublications: number;
  totalReadingTime: number; // seconds
  categoryBreakdown: Record<string, number>;
  recentReads: Array<{
    publication_id: string;
    title: string;
    author: string;
    category: string;
    cover_image_url: string | null;
    started_at: string;
    reading_duration_seconds: number;
  }>;
  weeklyActivity: Array<{ day: string; count: number }>;
}

export function useReadingHistory() {
  const { user } = useAuth();

  const { data: stats, isLoading } = useQuery<ReadingStats>({
    queryKey: ["reading-stats", user?.id],
    enabled: !!user,
    queryFn: async () => {
      // Get all reading history
      const { data: history, error } = await supabase
        .from("reading_history")
        .select("*")
        .eq("user_id", user!.id)
        .order("started_at", { ascending: false });

      if (error) throw error;

      // Get publication details for recent reads
      const uniquePubIds = [...new Set((history || []).map((h: ReadingRecord) => h.publication_id))];
      
      let publications: any[] = [];
      if (uniquePubIds.length > 0) {
        const { data: pubs } = await supabase
          .from("publications")
          .select("id, title, author, category, cover_image_url")
          .in("id", uniquePubIds);
        publications = pubs || [];
      }

      const pubMap = new Map(publications.map((p: any) => [p.id, p]));

      // Category breakdown
      const categoryBreakdown: Record<string, number> = {};
      for (const pubId of uniquePubIds) {
        const pub = pubMap.get(pubId);
        if (pub) {
          categoryBreakdown[pub.category] = (categoryBreakdown[pub.category] || 0) + 1;
        }
      }

      // Total reading time
      const totalReadingTime = (history || []).reduce(
        (sum: number, h: ReadingRecord) => sum + (h.reading_duration_seconds || 0), 0
      );

      // Recent reads (last 10 unique)
      const seenPubs = new Set<string>();
      const recentReads = [];
      for (const h of (history || []) as ReadingRecord[]) {
        if (seenPubs.has(h.publication_id)) continue;
        seenPubs.add(h.publication_id);
        const pub = pubMap.get(h.publication_id);
        if (pub) {
          recentReads.push({
            publication_id: h.publication_id,
            title: pub.title,
            author: pub.author,
            category: pub.category,
            cover_image_url: pub.cover_image_url,
            started_at: h.started_at,
            reading_duration_seconds: h.reading_duration_seconds,
          });
        }
        if (recentReads.length >= 10) break;
      }

      // Weekly activity (last 7 days)
      const weeklyActivity = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dayStr = date.toISOString().split("T")[0];
        const count = (history || []).filter((h: ReadingRecord) =>
          h.started_at.startsWith(dayStr)
        ).length;
        weeklyActivity.push({
          day: date.toLocaleDateString("fr-FR", { weekday: "short" }),
          count,
        });
      }

      return {
        totalPublications: uniquePubIds.length,
        totalReadingTime,
        categoryBreakdown,
        recentReads,
        weeklyActivity,
      };
    },
  });

  return { stats, isLoading };
}

export function useTrackReading() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const startReading = useMutation({
    mutationFn: async (publicationId: string) => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("reading_history")
        .insert({
          user_id: user.id,
          publication_id: publicationId,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reading-stats"] });
    },
  });

  const updateDuration = useMutation({
    mutationFn: async ({ recordId, seconds, lastPage }: { recordId: string; seconds: number; lastPage?: number }) => {
      const updateData: any = { reading_duration_seconds: seconds };
      if (lastPage && lastPage > 0) {
        updateData.last_page_read = lastPage;
      }
      const { error } = await supabase
        .from("reading_history")
        .update(updateData)
        .eq("id", recordId);
      if (error) throw error;
    },
  });

  return { startReading, updateDuration };
}

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

export function useAuditLog() {
  const queryClient = useQueryClient();

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["audit-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AuditEntry[];
    },
  });

  const addLog = useMutation({
    mutationFn: async (entry: {
      action: string;
      table_name: string;
      record_id?: string;
      old_value?: string;
      new_value?: string;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non authentifié");
      const { error } = await supabase.from("audit_log").insert({
        user_id: user.id,
        action: entry.action,
        table_name: entry.table_name,
        record_id: entry.record_id || null,
        old_value: entry.old_value || null,
        new_value: entry.new_value || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audit-log"] });
    },
  });

  return { logs, isLoading, addLog };
}

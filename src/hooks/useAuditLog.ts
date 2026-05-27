import { useQuery } from "@tanstack/react-query";
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

  // Audit log writes are reserved for SECURITY DEFINER database triggers only.
  return { logs, isLoading };
}

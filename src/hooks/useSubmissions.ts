import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface Submission {
  id: string;
  user_id: string;
  student_name: string;
  university: string;
  faculty: string;
  academic_year: string;
  title: string;
  description: string | null;
  category: string;
  file_url: string | null;
  status: string;
  admin_note: string | null;
  created_at: string;
  updated_at: string;
}

export function useMySubmissions() {
  const { user } = useAuth();
  return useQuery<Submission[]>({
    queryKey: ["my-submissions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Submission[];
    },
    enabled: !!user,
  });
}

export function useAdminSubmissions() {
  return useQuery<Submission[]>({
    queryKey: ["admin-submissions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submissions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as Submission[];
    },
  });
}

export function useCreateSubmission() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (submission: {
      student_name: string;
      university: string;
      faculty: string;
      academic_year: string;
      title: string;
      description: string;
      category: string;
      file_url: string;
    }) => {
      const { error } = await supabase.from("submissions").insert([
        { ...submission, user_id: user!.id },
      ] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-submissions"] });
    },
  });
}

export function useUpdateSubmissionStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      status,
      admin_note,
    }: {
      id: string;
      status: string;
      admin_note?: string;
    }) => {
      const { error } = await supabase
        .from("submissions")
        .update({ status, admin_note } as Record<string, unknown>)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-submissions"] });
    },
  });
}

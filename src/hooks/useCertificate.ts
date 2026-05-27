import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Certificate {
  id: string;
  publication_id: string;
  certificate_number: string;
  publication_number: string;
  verification_url: string;
  qr_code_url: string | null;
  certificate_pdf_url: string | null;
  status: string;
  publication_title: string;
  publication_author: string;
  publication_category: string;
  publication_date: string;
  issued_at: string;
  created_at: string;
}

export function useCertificate(publicationId?: string) {
  return useQuery({
    queryKey: ["certificate", publicationId],
    enabled: !!publicationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("publication_id", publicationId!)
        .maybeSingle();
      if (error) throw error;
      return data as Certificate | null;
    },
  });
}

export function useCertificateByNumber(number?: string) {
  return useQuery({
    queryKey: ["certificate-by-number", number],
    enabled: !!number,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .eq("certificate_number", number!)
        .maybeSingle();
      if (error) throw error;
      return data as Certificate | null;
    },
  });
}

export function useGenerateCertificate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (publicationId: string) => {
      const { data, error } = await supabase.functions.invoke("generate-certificate", {
        body: { publication_id: publicationId },
      });
      if (error) throw new Error(error.message);
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).certificate as Certificate;
    },
    onSuccess: (cert) => {
      toast.success("Certificat généré", { description: cert.certificate_number });
      qc.invalidateQueries({ queryKey: ["certificate", cert.publication_id] });
      qc.invalidateQueries({ queryKey: ["publication", cert.publication_id] });
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["admin-publications"] });
      qc.invalidateQueries({ queryKey: ["recent-certificates"] });
    },
    onError: (e: Error) => {
      toast.error("Échec de génération", { description: e.message });
    },
  });
}

export function useRecentCertificates(limit = 10) {
  return useQuery({
    queryKey: ["recent-certificates", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("certificates")
        .select("*")
        .order("issued_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as Certificate[];
    },
  });
}

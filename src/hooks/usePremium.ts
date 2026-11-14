// Abonnement Premium : lien de lecture protégé + outils d'administration.
// Les droits sont vérifiés par le serveur (fonction get-reading-url, fonctions SQL) :
// rien ici ne permet à un client de s'attribuer le Premium.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type SubscriptionPlan = Tables<"subscription_plans">;
export type SubscriptionRow = Tables<"subscriptions">;
export type PaymentRow = Tables<"payments">;
export type PaymentEventRow = Tables<"payment_events">;

/** Erreur renvoyée par get-reading-url quand la lecture est refusée. */
export class ReadingAccessError extends Error {
  constructor(message: string, public code: "login_required" | "premium_required" | "other") {
    super(message);
  }
}

async function functionError(error: unknown): Promise<{ message: string; code?: string }> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      return { message: body?.error || "Erreur", code: body?.code };
    } catch {
      /* corps illisible */
    }
  }
  return { message: error instanceof Error ? error.message : String(error) };
}

/**
 * Adresse du PDF à lire : publique pour une publication gratuite, lien signé (1 h) délivré par
 * le serveur pour une publication Premium, après vérification de l'abonnement.
 */
export function useReadingUrl(pub: { id: string; access_level?: string | null; file_url: string | null } | null | undefined, enabled = true) {
  const premium = pub?.access_level === "premium";
  return useQuery({
    queryKey: ["reading-url", pub?.id, premium ? "premium" : pub?.file_url],
    enabled: !!pub && enabled,
    staleTime: premium ? 45 * 60 * 1000 : Infinity, // lien signé valable 60 min
    retry: (count, err) => !(err instanceof ReadingAccessError) && count < 2,
    queryFn: async (): Promise<string | null> => {
      if (!pub) return null;
      if (!premium) return pub.file_url;
      const { data, error } = await supabase.functions.invoke("get-reading-url", { body: { publication_id: pub.id } });
      if (error) {
        const { message, code } = await functionError(error);
        throw new ReadingAccessError(message, code === "login_required" || code === "premium_required" ? code : "other");
      }
      return (data as { url?: string })?.url ?? null;
    },
  });
}

// ─── Administration ─────────────────────────────────────────────────────────────────────
export function usePlans() {
  return useQuery({
    queryKey: ["subscription-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").order("sort_order");
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });
}

export function useSavePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (plan: Partial<SubscriptionPlan> & { id?: string }) => {
      const { id, created_at: _c, updated_at: _u, ...fields } = plan;
      const q = id
        ? supabase.from("subscription_plans").update(fields).eq("id", id)
        : supabase.from("subscription_plans").insert(fields as SubscriptionPlan);
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["subscription-plans"] }),
  });
}

export interface AdminSubscription extends SubscriptionRow {
  email: string | null;
  full_name: string | null;
  plan_name: string | null;
}

export function useAdminSubscriptions() {
  return useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async (): Promise<AdminSubscription[]> => {
      const [{ data: subs, error }, { data: profiles }, { data: plans }] = await Promise.all([
        supabase.from("subscriptions").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("user_profiles").select("user_id,email,full_name"),
        supabase.from("subscription_plans").select("id,name"),
      ]);
      if (error) throw error;
      const byUser = new Map((profiles || []).map((p) => [p.user_id, p]));
      const byPlan = new Map((plans || []).map((p) => [p.id, p.name]));
      return (subs || []).map((s) => ({
        ...s,
        email: byUser.get(s.user_id)?.email ?? null,
        full_name: byUser.get(s.user_id)?.full_name ?? null,
        plan_name: s.plan_id ? byPlan.get(s.plan_id) ?? null : null,
      }));
    },
  });
}

export function useAdminPayments() {
  return useQuery({
    queryKey: ["admin-payments"],
    queryFn: async () => {
      const [{ data, error }, { data: profiles }] = await Promise.all([
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("user_profiles").select("user_id,email"),
      ]);
      if (error) throw error;
      const byUser = new Map((profiles || []).map((p) => [p.user_id, p.email]));
      return (data || []).map((p) => ({ ...p, email: byUser.get(p.user_id) ?? null }));
    },
  });
}

export function useAdminPaymentEvents() {
  return useQuery({
    queryKey: ["admin-payment-events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_events").select("*").order("received_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data as PaymentEventRow[];
    },
  });
}

function invalidatePremium(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ["admin-subscriptions"] });
  qc.invalidateQueries({ queryKey: ["admin-users"] });
  qc.invalidateQueries({ queryKey: ["user-profile"] });
}

export function useGrantPremium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; days: number | null; note?: string }) => {
      const { error } = await supabase.rpc("admin_grant_premium", {
        _user_id: input.userId,
        _days: input.days,
        _note: input.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidatePremium(qc),
  });
}

export function useRevokePremium() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string; note?: string }) => {
      const { error } = await supabase.rpc("admin_revoke_premium", { _user_id: input.userId, _note: input.note ?? null });
      if (error) throw error;
    },
    onSuccess: () => invalidatePremium(qc),
  });
}

/** Réglage « Réserver les livres Premium aux abonnés » (site_settings.premium_enforced). */
export function usePremiumEnforced() {
  return useQuery({
    queryKey: ["site-setting", "premium_enforced"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "premium_enforced").maybeSingle();
      return data?.value === "true";
    },
  });
}

export function useSetPremiumEnforced() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: boolean) => {
      const { error } = await supabase.from("site_settings").update({ value: value ? "true" : "false" }).eq("key", "premium_enforced");
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site-setting", "premium_enforced"] }),
  });
}

/** Passe une publication en gratuit / Premium (déplacement du PDF côté serveur). */
export function useSetPublicationAccess() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { publicationId: string; accessLevel: "free" | "premium" }) => {
      const { error } = await supabase.functions.invoke("set-publication-access", {
        body: { publication_id: input.publicationId, access_level: input.accessLevel },
      });
      if (error) throw new Error((await functionError(error)).message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-premium-publications"] });
      qc.invalidateQueries({ queryKey: ["publications"] });
      qc.invalidateQueries({ queryKey: ["publication"] });
      qc.invalidateQueries({ queryKey: ["reading-url"] });
    },
  });
}

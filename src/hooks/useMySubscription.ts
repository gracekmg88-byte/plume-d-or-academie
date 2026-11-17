// « Mon abonnement » : périodes, paiements et formules du compte connecté.
// Lecture seule (RLS : chacun ne voit que ses lignes). Le statut affiché est calculé à partir
// des mêmes règles que le serveur ; l'accès réel aux livres reste vérifié côté serveur.
import { useQuery } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { billingConfig } from "@/config/billing";

export type Plan = Tables<"subscription_plans">;
export type Period = Tables<"subscriptions">;
export type Payment = Tables<"payments">;

export interface MySubscriptionState {
  periods: Period[];
  payments: Payment[];
  plans: Plan[];
  activePlans: Plan[];
  isActive: boolean;
  isUnlimited: boolean;
  startedAt: Date | null;
  expiresAt: Date | null; // null si sans date de fin ou sans abonnement
  daysLeft: number | null;
  currentPlan: Plan | null;
  /** Dernière échéance passée (abonnement expiré), pour l'afficher. */
  lastExpiredAt: Date | null;
}

const DAY = 86_400_000;

export function computeSubscription(periods: Period[], plans: Plan[], now = new Date()): Omit<MySubscriptionState, "periods" | "payments" | "plans" | "activePlans"> {
  const active = periods.filter(
    (p) => p.status === "active" && (p.expires_at === null || new Date(p.expires_at) > now),
  );
  const covering = active.find((p) => new Date(p.started_at) <= now);
  const isActive = !!covering;
  const isUnlimited = active.some((p) => p.expires_at === null);
  const expiresAt = !active.length || isUnlimited ? null : new Date(Math.max(...active.map((p) => new Date(p.expires_at!).getTime())));
  const startedAt = active.length ? new Date(Math.min(...active.map((p) => new Date(p.started_at).getTime()))) : null;
  const daysLeft = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY)) : null;
  const planById = new Map(plans.map((p) => [p.id, p]));
  const currentPlan = covering?.plan_id ? planById.get(covering.plan_id) ?? null : null;
  const past = periods.filter((p) => p.expires_at && new Date(p.expires_at) <= now).map((p) => new Date(p.expires_at!).getTime());
  return {
    isActive,
    isUnlimited,
    startedAt,
    expiresAt,
    daysLeft,
    currentPlan,
    lastExpiredAt: !isActive && past.length ? new Date(Math.max(...past)) : null,
  };
}

export type PaymentProvider = "google_play" | "apple_iap" | "opt_gateway";

/**
 * Le paiement est-il possible ici ? Android : Google Play uniquement ; iPhone : App Store
 * uniquement (règle d'Apple : aucun autre moyen de paiement dans l'appli) ; site : carte / mobile money.
 */
export function availablePaymentProvider(optGatewayOpen = false, googlePlayOpen = false, appStoreOpen = false): PaymentProvider | null {
  if (Capacitor.isNativePlatform()) {
    const platform = Capacitor.getPlatform();
    if (platform === "android") return googlePlayOpen ? "google_play" : null;
    if (platform === "ios") return appStoreOpen ? "apple_iap" : null;
    return null;
  }
  return optGatewayOpen ? "opt_gateway" : null;
}

/**
 * Moyen de paiement proposé à ce visiteur. Sur le site, la carte (OPTGateway) est ouverte par le
 * réglage opt_gateway_enabled ; un administrateur la voit aussi avant ouverture, pour tester
 * (le serveur applique la même règle).
 */
export function usePaymentProvider() {
  const { isAdmin } = useAuth();
  const { data: settings } = useQuery({
    queryKey: ["site-setting", "payment_providers"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key,value").in("key", ["opt_gateway_enabled", "google_play_enabled", "apple_iap_enabled"]);
      const get = (k: string) => data?.find((d) => d.key === k)?.value === "true";
      return { opt: get("opt_gateway_enabled"), play: get("google_play_enabled"), apple: get("apple_iap_enabled") };
    },
  });
  const native = Capacitor.isNativePlatform();
  const ios = native && Capacitor.getPlatform() === "ios";
  const open = native ? (ios ? !!settings?.apple : !!settings?.play) : !!settings?.opt;
  const provider = availablePaymentProvider(
    !!settings?.opt || (!native && !!isAdmin),
    !!settings?.play || (native && !!isAdmin),
    !!settings?.apple || (ios && !!isAdmin),
  );
  return { provider, adminTest: !!isAdmin && !open };
}

export function useMySubscription() {
  const { user, authReady } = useAuth();
  return useQuery({
    queryKey: ["my-subscription", user?.id],
    enabled: authReady && !!user?.id,
    staleTime: 60_000,
    queryFn: async (): Promise<MySubscriptionState> => {
      const [subs, pays, plans] = await Promise.all([
        supabase.from("subscriptions").select("*").eq("user_id", user!.id).order("started_at", { ascending: false }),
        supabase.from("payments").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }).limit(100),
        supabase.from("subscription_plans").select("*").order("sort_order"),
      ]);
      if (subs.error) throw subs.error;
      const periods = (subs.data || []) as Period[];
      const allPlans = (plans.data || []) as Plan[];
      return {
        periods,
        payments: (pays.data || []) as Payment[],
        plans: allPlans,
        activePlans: allPlans.filter((p) => p.is_active && p.price_amount != null),
        ...computeSubscription(periods, allPlans),
      };
    },
  });
}

/** Formules proposées (actives et avec prix), lisibles sans être connecté. */
export function useActivePlans() {
  return useQuery({
    queryKey: ["active-plans"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
      if (error) throw error;
      return ((data || []) as Plan[]).filter((p) => p.price_amount != null);
    },
  });
}

export function formatPrice(amount: number | null | undefined, currency: string | null | undefined) {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "USD", maximumFractionDigits: 2 }).format(amount);
  } catch {
    return `${amount} ${currency ?? ""}`.trim();
  }
}

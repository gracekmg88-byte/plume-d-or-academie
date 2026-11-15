import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => ({}) }));

import { computeSubscription } from "./useMySubscription";

const now = new Date("2026-11-15T12:00:00Z");
const plan = { id: "m", name: "Premium mensuel", duration_days: 30 } as never;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const P = (o: Record<string, unknown>): any => ({ id: Math.random().toString(), status: "active", plan_id: "m", payment_provider: "opt_gateway", ...o });
const ymd = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("computeSubscription (Mon abonnement)", () => {
  it("aucun abonnement", () => {
    const r = computeSubscription([], [plan], now);
    expect(r.isActive).toBe(false);
    expect(r.expiresAt).toBeNull();
    expect(r.lastExpiredAt).toBeNull();
  });

  it("actif avec 10 jours restants", () => {
    const r = computeSubscription([P({ started_at: "2026-10-26T12:00:00Z", expires_at: "2026-11-25T12:00:00Z" })], [plan], now);
    expect(r.isActive).toBe(true);
    expect(r.daysLeft).toBe(10);
    expect(ymd(r.startedAt)).toBe("2026-10-26");
    expect((r.currentPlan as { name: string } | null)?.name).toBe("Premium mensuel");
  });

  it("renouvellement empilé : la fin est celle de la dernière période", () => {
    const r = computeSubscription(
      [
        P({ started_at: "2026-10-26T12:00:00Z", expires_at: "2026-11-25T12:00:00Z" }),
        P({ started_at: "2026-11-25T12:00:00Z", expires_at: "2026-12-25T12:00:00Z" }),
      ],
      [plan],
      now,
    );
    expect(ymd(r.expiresAt)).toBe("2026-12-25");
    expect(r.daysLeft).toBe(40);
    expect(ymd(r.startedAt)).toBe("2026-10-26");
  });

  it("expiré : date de la dernière échéance", () => {
    const r = computeSubscription([P({ started_at: "2026-09-01T12:00:00Z", expires_at: "2026-10-01T12:00:00Z", status: "expired" })], [plan], now);
    expect(r.isActive).toBe(false);
    expect(ymd(r.lastExpiredAt)).toBe("2026-10-01");
  });

  it("attribution admin sans date de fin", () => {
    const r = computeSubscription([P({ plan_id: null, payment_provider: "admin", started_at: "2026-01-31T12:00:00Z", expires_at: null })], [plan], now);
    expect(r.isActive).toBe(true);
    expect(r.isUnlimited).toBe(true);
    expect(r.expiresAt).toBeNull();
    expect(r.daysLeft).toBeNull();
  });

  it("révoqué : plus actif", () => {
    const r = computeSubscription([P({ started_at: "2026-11-01T12:00:00Z", expires_at: "2026-12-01T12:00:00Z", status: "revoked" })], [plan], now);
    expect(r.isActive).toBe(false);
  });
});

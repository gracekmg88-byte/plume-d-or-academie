import { supabase } from "@/integrations/supabase/client";

export type AuthAuditEvent =
  | "sign_in"
  | "sign_out"
  | "token_refreshed"
  | "session_restored"
  | "session_lost"
  | "admin_check"
  | "admin_check_failed"
  | "admin_route_denied"
  | "admin_route_granted";

interface LogPayload {
  user_id?: string | null;
  email?: string | null;
  is_admin?: boolean | null;
  metadata?: Record<string, unknown>;
}

/**
 * Fire-and-forget logger for authentication events.
 * Writes to `public.auth_audit_log`. RLS allows anyone to insert.
 */
export function logAuthEvent(event_type: AuthAuditEvent, payload: LogPayload = {}) {
  try {
    const row = {
      event_type,
      user_id: payload.user_id ?? null,
      email: payload.email ?? null,
      is_admin: payload.is_admin ?? null,
      metadata: {
        ...(payload.metadata ?? {}),
        url: typeof window !== "undefined" ? window.location.pathname : null,
      },
      user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
    };

    // Do not await — never block the auth flow on logging
    void supabase
      .from("auth_audit_log")
      .insert(row)
      .then(({ error }) => {
        if (error) {
          // eslint-disable-next-line no-console
          console.warn("[auth-audit] insert failed", error.message);
        }
      });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn("[auth-audit] logger threw", e);
  }
}

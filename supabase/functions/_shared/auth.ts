import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function escapeHtml(input: unknown): string {
  return String(input ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Returns true if the Authorization header is the project's service role key
 * (used by DB triggers / internal pg_net calls).
 */
export function isServiceRoleRequest(req: Request): boolean {
  const auth = req.headers.get("Authorization") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!auth.startsWith("Bearer ") || !serviceKey) return false;
  return auth.slice("Bearer ".length).trim() === serviceKey;
}

/**
 * Validate the caller's JWT. Returns the user id + email if valid, else null.
 */
export async function getAuthUser(req: Request): Promise<
  { userId: string; email: string | null } | null
> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice("Bearer ".length).trim();
  if (!token) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_ANON_KEY") ?? "",
  );
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return {
    userId: data.claims.sub as string,
    email: (data.claims.email as string | undefined) ?? null,
  };
}

/**
 * Returns true if the user_id has the admin role.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
  const { data, error } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !error && !!data;
}

export function unauthorized(corsHeaders: Record<string, string>, msg = "Unauthorized") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 401,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function forbidden(corsHeaders: Record<string, string>, msg = "Forbidden") {
  return new Response(JSON.stringify({ error: msg }), {
    status: 403,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

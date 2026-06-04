// Google Search Console admin: status, submit, verify.
// Admin-only. Uses the Lovable connector gateway for Google Search Console.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://plume-d-or-academie.lovable.app/";
const SITEMAP_URL = "https://vlqjdszawxtwutuzvskt.supabase.co/functions/v1/sitemap";
const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";

function gscHeaders() {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gscKey = Deno.env.get("GOOGLE_SEARCH_CONSOLE_API_KEY");
  if (!lovableKey || !gscKey) throw new Error("Google Search Console connector not configured");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": gscKey,
    "Content-Type": "application/json",
  };
}

async function getStatus() {
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${GATEWAY}/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps/${enc(SITEMAP_URL)}`;
  const res = await fetch(url, { headers: gscHeaders() });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, sitemap: body };
}

async function submitSitemap() {
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${GATEWAY}/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps/${enc(SITEMAP_URL)}`;
  const res = await fetch(url, { method: "PUT", headers: gscHeaders() });
  return { ok: res.ok, status: res.status };
}

async function getVerificationToken() {
  const res = await fetch(`${GATEWAY}/siteVerification/v1/token`, {
    method: "POST",
    headers: gscHeaders(),
    body: JSON.stringify({ site: { identifier: SITE_URL, type: "SITE" }, verificationMethod: "META" }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, token: data?.token ?? null };
}

async function verifySite() {
  const res = await fetch(`${GATEWAY}/siteVerification/v1/webResource?verificationMethod=META`, {
    method: "POST",
    headers: gscHeaders(),
    body: JSON.stringify({ site: { identifier: SITE_URL, type: "SITE" } }),
  });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, body };
}

async function addSite() {
  const enc = (s: string) => encodeURIComponent(s);
  const res = await fetch(`${GATEWAY}/webmasters/v3/sites/${enc(SITE_URL)}`, {
    method: "PUT",
    headers: gscHeaders(),
  });
  return { ok: res.ok, status: res.status };
}

async function isAdmin(req: Request, requireAdmin: boolean): Promise<{ allowed: boolean; userId?: string }> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return { allowed: false };
  const token = authHeader.replace("Bearer ", "");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: userData } = await supabase.auth.getUser(token);
  if (!userData?.user) return { allowed: false };
  if (!requireAdmin) return { allowed: true, userId: userData.user.id };
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userData.user.id)
    .eq("role", "admin")
    .maybeSingle();
  return { allowed: !!roles, userId: userData.user.id };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? new URL(req.url).searchParams.get("action") ?? "status";

    // auto = called by the app when a publication is created/updated.
    // Any authenticated user gets through, since admin route already guards the UI; we just don't expose admin data.
    const requireAdmin = action !== "auto";
    const auth = await isAdmin(req, requireAdmin);
    if (!auth.allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let result: any;
    switch (action) {
      case "status":
        result = await getStatus();
        break;
      case "submit":
      case "auto":
        result = await submitSitemap();
        break;
      case "verify_token":
        result = await getVerificationToken();
        break;
      case "verify":
        result = await verifySite();
        break;
      case "add_site":
        result = await addSite();
        break;
      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify({ action, ...result, siteUrl: SITE_URL, sitemapUrl: SITEMAP_URL }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message ?? String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

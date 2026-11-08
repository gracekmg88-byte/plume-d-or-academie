// Google Search Console admin: status, submit, verify.
// Admin-only. Appelle directement les API Google (Search Console + Site Verification)
// avec un compte de service : secret GSC_SERVICE_ACCOUNT_JSON. Le compte de service doit être
// ajouté comme propriétaire de la propriété dans Search Console.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getGoogleAccessToken, readServiceAccount } from "../_shared/google.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_ORIGIN = (Deno.env.get("SITE_URL") ?? "https://www.kmgbibliotheque.com").replace(/\/+$/, "");
const SITE_URL = `${SITE_ORIGIN}/`;
const SITEMAP_URL = Deno.env.get("SITEMAP_URL") ?? `${SITE_ORIGIN}/sitemap.xml`;
const GATEWAY = "https://www.googleapis.com";
const SCOPES = [
  "https://www.googleapis.com/auth/webmasters",
  "https://www.googleapis.com/auth/siteverification",
];

async function gscHeaders() {
  const token = await getGoogleAccessToken(readServiceAccount("GSC_SERVICE_ACCOUNT_JSON"), SCOPES);
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

async function getStatus() {
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${GATEWAY}/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps/${enc(SITEMAP_URL)}`;
  const res = await fetch(url, { headers: await gscHeaders() });
  const text = await res.text();
  let body: any = null;
  try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { ok: res.ok, status: res.status, sitemap: body };
}

async function submitSitemap() {
  const enc = (s: string) => encodeURIComponent(s);
  const url = `${GATEWAY}/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps/${enc(SITEMAP_URL)}`;
  const res = await fetch(url, { method: "PUT", headers: await gscHeaders() });
  return { ok: res.ok, status: res.status };
}

async function getVerificationToken() {
  const res = await fetch(`${GATEWAY}/siteVerification/v1/token`, {
    method: "POST",
    headers: await gscHeaders(),
    body: JSON.stringify({ site: { identifier: SITE_URL, type: "SITE" }, verificationMethod: "META" }),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, token: data?.token ?? null };
}

async function verifySite() {
  const res = await fetch(`${GATEWAY}/siteVerification/v1/webResource?verificationMethod=META`, {
    method: "POST",
    headers: await gscHeaders(),
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
    headers: await gscHeaders(),
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

    // All actions require an admin user. Non-admin contexts (DB triggers, etc.) should use the service role key.
    const auth = await isAdmin(req, true);
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
      case "auto":
      case "onboard": {
        // Full pipeline: verify ownership → add site → submit sitemap → return status.
        const verify = await verifySite();
        const addSiteRes = verify.ok ? await addSite() : { ok: false, status: 0, skipped: true };
        const submit = (verify.ok || action === "auto") ? await submitSitemap() : { ok: false, status: 0, skipped: true };
        const status = await getStatus();
        result = { ok: verify.ok && submit.ok, steps: { verify, addSite: addSiteRes, submit }, ...status };
        break;
      }
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

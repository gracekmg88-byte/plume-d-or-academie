// @ts-nocheck
// Lien de lecture d'une publication — vérification des droits CÔTÉ SERVEUR.
//
//  • Publication gratuite : renvoie son adresse publique habituelle.
//  • Publication Premium : le PDF est dans le bucket privé « premium-files ». Si le contrôle
//    Premium est activé (réglage site_settings.premium_enforced = 'true'), seul un compte
//    Premium actif (ou admin) reçoit un lien signé valable 1 heure ; sinon tout le monde le
//    reçoit (même comportement qu'aujourd'hui, où tout est gratuit).
//
// Le statut Premium est calculé par la base (public.user_has_premium) à partir des périodes
// d'abonnement : l'application ne peut pas l'imposer.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SIGNED_URL_SECONDS = 3600;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function callerId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.slice(7).trim();
  if (!token || token === ANON_KEY) return null;
  const { data, error } = await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token);
  return error || !data?.user ? null : data.user.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const publicationId = body?.publication_id;
    if (typeof publicationId !== "string" || !UUID_RE.test(publicationId)) {
      return json({ error: "publication_id invalide" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const userId = await callerId(req);

    const { data: pub, error: pubErr } = await admin
      .from("publications")
      .select("id, is_published, access_level, file_url, premium_file_path")
      .eq("id", publicationId)
      .maybeSingle();
    if (pubErr) throw pubErr;

    let isAdmin = false;
    if (userId) {
      const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
      isAdmin = !!role;
    }
    if (!pub || (!pub.is_published && !isAdmin)) return json({ error: "Publication introuvable" }, 404);

    if (pub.access_level !== "premium") {
      if (!pub.file_url) return json({ error: "Aucun fichier pour cette publication" }, 404);
      return json({ url: pub.file_url, access: "free" });
    }

    // Publication Premium
    const { data: setting } = await admin.from("site_settings").select("value").eq("key", "premium_enforced").maybeSingle();
    const enforced = setting?.value === "true";

    if (enforced && !isAdmin) {
      if (!userId) return json({ error: "Connectez-vous pour lire ce document réservé aux abonnés.", code: "login_required" }, 401);
      const { data: premium, error: rpcErr } = await admin.rpc("user_has_premium", { _user_id: userId });
      if (rpcErr) throw rpcErr;
      if (!premium) return json({ error: "Ce document est réservé aux abonnés Premium.", code: "premium_required" }, 403);
    }

    if (!pub.premium_file_path) {
      // Fichier pas encore déplacé (cas transitoire) : adresse publique si elle existe encore.
      if (pub.file_url) return json({ url: pub.file_url, access: "premium" });
      return json({ error: "Fichier indisponible" }, 404);
    }

    const { data: signed, error: signErr } = await admin.storage
      .from("premium-files")
      .createSignedUrl(pub.premium_file_path, SIGNED_URL_SECONDS);
    if (signErr || !signed?.signedUrl) throw signErr ?? new Error("Lien signé impossible");

    return json({ url: signed.signedUrl, access: "premium", expires_in: SIGNED_URL_SECONDS });
  } catch (e) {
    console.error("get-reading-url", e);
    return json({ error: "Erreur serveur" }, 500);
  }
});

// @ts-nocheck
// Admin : passe une publication en « gratuit » ou « réservé aux abonnés » et déplace son PDF.
//
//  • gratuit → premium : le PDF est copié dans le bucket privé « premium-files », la publication
//    ne garde plus d'adresse publique (file_url = NULL), puis la copie publique est supprimée.
//  • premium → gratuit : opération inverse (le PDF redevient public dans « publications/files »).
//
// Idempotent : relancer l'opération ne casse rien (utile si un nouveau PDF a été envoyé sur une
// publication déjà Premium : il est alors déplacé à son tour).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PUBLIC_MARKER = "/storage/v1/object/public/publications/";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

function publicPath(fileUrl: string | null): string | null {
  if (!fileUrl) return null;
  const i = fileUrl.indexOf(PUBLIC_MARKER);
  if (i === -1) return null;
  return decodeURIComponent(fileUrl.slice(i + PUBLIC_MARKER.length).split("?")[0]);
}

async function moveObject(admin, fromBucket: string, fromPath: string, toBucket: string, toPath: string) {
  const { data: blob, error: dlErr } = await admin.storage.from(fromBucket).download(fromPath);
  if (dlErr || !blob) throw new Error(`Lecture impossible (${fromBucket}/${fromPath}) : ${dlErr?.message ?? "vide"}`);
  const { error: upErr } = await admin.storage.from(toBucket).upload(toPath, blob, {
    contentType: "application/pdf",
    upsert: true,
    cacheControl: toBucket === "publications" ? "31536000" : "3600",
  });
  if (upErr) throw new Error(`Écriture impossible (${toBucket}/${toPath}) : ${upErr.message}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const { data: userData } = token ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token) : { data: null };
    const userId = userData?.user?.id;
    if (!userId) return json({ error: "Non authentifié" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Réservé aux administrateurs" }, 403);

    const body = await req.json().catch(() => ({}));
    const publicationId = body?.publication_id;
    const target = body?.access_level;
    if (typeof publicationId !== "string" || !UUID_RE.test(publicationId)) return json({ error: "publication_id invalide" }, 400);
    if (target !== "free" && target !== "premium") return json({ error: "access_level doit valoir free ou premium" }, 400);

    const { data: pub, error } = await admin
      .from("publications")
      .select("id, title, access_level, file_url, premium_file_path")
      .eq("id", publicationId)
      .maybeSingle();
    if (error) throw error;
    if (!pub) return json({ error: "Publication introuvable" }, 404);

    const before = { access_level: pub.access_level, file_url: pub.file_url, premium_file_path: pub.premium_file_path };
    let update: Record<string, unknown> = {};
    let toDelete: { bucket: string; path: string } | null = null;

    if (target === "premium") {
      const src = publicPath(pub.file_url);
      if (src) {
        // Nouveau PDF public (passage en Premium, ou remplacement du fichier) → bucket privé.
        const dest = `files/${src.split("/").pop()}`;
        await moveObject(admin, "publications", src, "premium-files", dest);
        if (pub.premium_file_path && pub.premium_file_path !== dest) {
          await admin.storage.from("premium-files").remove([pub.premium_file_path]);
        }
        update = { access_level: "premium", premium_file_path: dest, file_url: null };
        toDelete = { bucket: "publications", path: src };
      } else if (pub.premium_file_path) {
        update = { access_level: "premium" };
      } else {
        return json({ error: "Cette publication n'a pas de fichier PDF à protéger" }, 400);
      }
    } else {
      if (pub.premium_file_path) {
        const dest = `files/${pub.premium_file_path.split("/").pop()}`;
        await moveObject(admin, "premium-files", pub.premium_file_path, "publications", dest);
        const fileUrl = admin.storage.from("publications").getPublicUrl(dest).data.publicUrl;
        update = { access_level: "free", premium_file_path: null, file_url: fileUrl };
        toDelete = { bucket: "premium-files", path: pub.premium_file_path };
      } else {
        update = { access_level: "free" };
      }
    }

    const { error: updErr } = await admin.from("publications").update(update).eq("id", publicationId);
    if (updErr) throw updErr;
    // Suppression de l'ancienne copie seulement après la mise à jour réussie de la fiche.
    if (toDelete) {
      const { error: rmErr } = await admin.storage.from(toDelete.bucket).remove([toDelete.path]);
      if (rmErr) console.warn("set-publication-access : ancienne copie non supprimée", rmErr.message);
    }

    await admin.from("audit_log").insert({
      user_id: userId,
      action: "set_publication_access",
      table_name: "publications",
      record_id: publicationId,
      old_value: JSON.stringify(before),
      new_value: JSON.stringify(update),
    });

    return json({ success: true, access_level: target });
  } catch (e) {
    console.error("set-publication-access", e);
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});

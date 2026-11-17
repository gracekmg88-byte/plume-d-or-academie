// @ts-nocheck
// Suppression définitive du compte par l'utilisateur lui-même (Profil → « Supprimer mon compte »).
// Exigée par Google Play et par l'App Store.
//
//  • Efface : profil, rôles, abonnement, favoris, historique de lecture, annotations, commentaires,
//    messages du salon, notifications et préférences, appareils (notifications push), mémoires
//    déposés (fiches et fichiers), journal de connexion, puis le compte lui-même.
//  • Conserve, sans lien avec la personne : les paiements (pièces comptables, user_id = NULL) et
//    les publications déjà en ligne dans la bibliothèque.
//  • Refuse : les comptes administrateurs, et les comptes dont un paiement est en cours de
//    confirmation (pour ne pas encaisser un paiement sans compte à activer).
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const PENDING_WINDOW_MIN = 30;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Tables sans lien automatique avec le compte : à vider explicitement.
const USER_TABLES = [
  "annotations",
  "chat_messages",
  "comments",
  "device_tokens",
  "favorites",
  "notification_preferences",
  "notifications",
  "reading_history",
  "submissions",
  "subscription_reminders",
  "auth_audit_log",
];

async function removeFolder(admin, bucket: string, prefix: string) {
  for (let round = 0; round < 20; round++) {
    const { data, error } = await admin.storage.from(bucket).list(prefix, { limit: 100 });
    if (error) throw new Error(`Lecture des fichiers impossible : ${error.message}`);
    const files = (data ?? []).filter((f) => f.id).map((f) => `${prefix}/${f.name}`);
    if (files.length === 0) return;
    const { error: rmErr } = await admin.storage.from(bucket).remove(files);
    if (rmErr) throw new Error(`Suppression des fichiers impossible : ${rmErr.message}`);
  }
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

    const body = await req.json().catch(() => ({}));
    if (String(body?.confirm ?? "").trim().toUpperCase() !== "SUPPRIMER") {
      return json({ error: "Confirmation manquante", code: "confirm_required" }, 400);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (role) {
      return json({ error: "Un compte administrateur ne peut pas être supprimé depuis le profil.", code: "admin" }, 403);
    }

    const since = new Date(Date.now() - PENDING_WINDOW_MIN * 60_000).toISOString();
    const { count: pending } = await admin
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending")
      .gte("created_at", since);
    if (pending) {
      return json({
        error: "Un paiement est en cours de confirmation. Réessayez dans une trentaine de minutes.",
        code: "payment_pending",
      }, 409);
    }

    // Fichiers des mémoires déposés (bucket privé « submissions », dossier = identifiant du compte).
    await removeFolder(admin, "submissions", userId);

    for (const table of USER_TABLES) {
      const { error } = await admin.from(table).delete().eq("user_id", userId);
      if (error) throw new Error(`Effacement impossible (${table}) : ${error.message}`);
    }

    // Le compte : profil, rôles et abonnements suivent automatiquement ; les paiements sont détachés.
    const { error: delErr } = await admin.auth.admin.deleteUser(userId);
    if (delErr) throw new Error(`Suppression du compte impossible : ${delErr.message}`);

    return json({ ok: true });
  } catch (e) {
    console.error("delete-account", e);
    return json({ error: "La suppression n'a pas pu aboutir. Réessayez ou contactez-nous.", detail: String(e?.message ?? e) }, 500);
  }
});

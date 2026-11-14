// @ts-nocheck
// Rappels d'expiration des abonnements Premium (renouvellement manuel).
//
// Appelée chaque jour par pg_cron (clé de service) ou par un administrateur depuis l'admin.
// Pour chaque compte dont l'abonnement payé arrive à échéance :
//   • J-7 (≤ 7 jours), J-3 (≤ 3 jours), J0 (≤ 24 h) — un seul rappel par échéance et par type ;
//     si un rappel plus urgent a déjà été envoyé, les moins urgents ne partent plus ;
//   • canaux : notification dans l'appli et sur le site (table notifications), push sur les
//     appareils du compte (si activé), e-mail si l'adresse est vérifiée (si activé).
// Les abonnements sans date de fin (attribués par l'admin) ne reçoivent aucun rappel.
// Corps facultatif : { "dry_run": true } → simulation, rien n'est envoyé ni enregistré.
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SITE_URL = (Deno.env.get("SITE_URL") ?? "https://www.kmgbibliotheque.com").replace(/\/+$/, "");
const DAY = 86_400_000;
const URGENCY: Record<string, number> = { j7: 1, j3: 2, j0: 3 };

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });

const esc = (s: unknown) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function longDate(d: Date) {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Kinshasa" });
}

function kindFor(msLeft: number): "j7" | "j3" | "j0" | null {
  if (msLeft <= 0) return null;
  if (msLeft <= DAY) return "j0";
  if (msLeft <= 3 * DAY) return "j3";
  if (msLeft <= 7 * DAY) return "j7";
  return null;
}

function texts(kind: string, end: Date) {
  const date = longDate(end);
  const daysLeft = Math.max(1, Math.ceil((end.getTime() - Date.now()) / DAY));
  if (kind === "j0") {
    return {
      title: "Votre abonnement Premium expire aujourd'hui",
      body: `Votre accès Premium prend fin aujourd'hui (${date}). Renouvelez-le pour continuer à lire les livres réservés aux abonnés.`,
    };
  }
  return {
    title: `Votre abonnement Premium expire dans ${daysLeft} jours`,
    body: `Votre accès Premium prend fin le ${date}. Renouvelez-le dès maintenant : les jours restants s'ajoutent à la nouvelle période.`,
  };
}

// ─── Push (Firebase Cloud Messaging, API v1) ───────────────────────────────────────────
async function fcmAccessToken(sa) {
  const now = Math.floor(Date.now() / 1000);
  const b64u = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const unsigned = `${b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64u(JSON.stringify({
    iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const pem = sa.private_key.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s+/g, "");
  const key = await crypto.subtle.importKey("pkcs8", Uint8Array.from(atob(pem), (c) => c.charCodeAt(0)),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const jwt = `${unsigned}.${btoa(String.fromCharCode(...sig)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")}`;
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const t = await r.json();
  if (!t.access_token) throw new Error("Jeton Firebase refusé");
  return t.access_token as string;
}

async function sendPush(fcm, tokens: string[], title: string, body: string) {
  let ok = 0;
  for (const token of tokens) {
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${fcm.projectId}/messages:send`, {
      method: "POST",
      headers: { Authorization: `Bearer ${fcm.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { click_action: "OPEN_SUBSCRIPTION", url: "/profil" },
          android: { priority: "high", notification: { channel_id: "new_publications", icon: "ic_notification", color: "#D4AF37" } },
        },
      }),
    });
    if (r.ok) ok++;
  }
  return ok;
}

// ─── E-mail (Resend) ────────────────────────────────────────────────────────────────────
async function sendEmail(to: string, name: string | null, title: string, body: string) {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) throw new Error("RESEND_API_KEY absente");
  const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#f6f3ea;font-family:Georgia,'Times New Roman',serif;color:#1f2937">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
  <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e5dcc3;border-radius:12px">
  <tr><td style="background:#0f172a;border-radius:12px 12px 0 0;padding:20px 28px;color:#e8c46a;font-size:20px;letter-spacing:1px">KMG BIBLIOTHÈQUE</td></tr>
  <tr><td style="padding:28px">
    <p style="margin:0 0 12px">Bonjour${name ? " " + esc(name) : ""},</p>
    <h1 style="font-size:20px;margin:0 0 12px;color:#0f172a">${esc(title)}</h1>
    <p style="margin:0 0 20px;line-height:1.6">${esc(body)}</p>
    <p style="margin:0 0 24px"><a href="${SITE_URL}/profil" style="display:inline-block;background:#b8913f;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-family:Arial,sans-serif;font-weight:bold">Renouveler mon abonnement</a></p>
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.5">Votre abonnement ne se renouvelle jamais automatiquement : aucun montant n'est prélevé sans votre action. Votre historique de lecture et vos favoris restent conservés.</p>
  </td></tr></table>
  <p style="font-size:12px;color:#9ca3af;margin-top:16px">KMG Bibliothèque — ${SITE_URL.replace(/^https?:\/\//, "")}</p>
  </td></tr></table></body></html>`;
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: Deno.env.get("EMAIL_FROM") ?? "KMG Bibliothèque <noreply@kmgbibliotheque.com>",
      to: [to], subject: title, html, text: `${title}\n\n${body}\n\nRenouveler : ${SITE_URL}/profil`,
    }),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Autorisation : tâche planifiée (clé de service) ou administrateur connecté.
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token !== SERVICE_KEY) {
    const { data } = token ? await createClient(SUPABASE_URL, ANON_KEY).auth.getUser(token) : { data: null };
    const uid = data?.user?.id;
    if (!uid) return json({ error: "Non authentifié" }, 401);
    const { data: role } = await admin.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle();
    if (!role) return json({ error: "Réservé aux administrateurs" }, 403);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const dryRun = body?.dry_run === true;

    const { data: settings } = await admin.from("site_settings").select("key,value")
      .in("key", ["premium_reminders_push", "premium_reminders_email"]);
    const setting = (k: string) => settings?.find((s) => s.key === k)?.value === "true";
    const pushOn = setting("premium_reminders_push");
    const emailOn = setting("premium_reminders_email");

    // Échéance de chaque compte = fin de sa dernière période active (sauf période sans fin).
    const { data: subs, error } = await admin.from("subscriptions").select("user_id, expires_at").eq("status", "active");
    if (error) throw error;
    const ends = new Map<string, Date | "infinite">();
    for (const s of subs ?? []) {
      const cur = ends.get(s.user_id);
      if (cur === "infinite") continue;
      if (s.expires_at === null) { ends.set(s.user_id, "infinite"); continue; }
      const d = new Date(s.expires_at);
      if (!cur || d > cur) ends.set(s.user_id, d);
    }

    const due: { user_id: string; end: Date; kind: string }[] = [];
    for (const [user_id, end] of ends) {
      if (end === "infinite") continue;
      const kind = kindFor(end.getTime() - Date.now());
      if (kind) due.push({ user_id, end, kind });
    }

    let fcm = null;
    const results = [];
    for (const d of due) {
      const endIso = d.end.toISOString();
      // Rappels déjà envoyés pour cette échéance : on n'envoie jamais un rappel moins urgent.
      const { data: already } = await admin.from("subscription_reminders").select("kind").eq("user_id", d.user_id).eq("expires_at", endIso);
      const maxSent = Math.max(0, ...(already ?? []).map((r) => URGENCY[r.kind] ?? 0));
      if (maxSent >= URGENCY[d.kind]) continue;

      const { title, body: message } = texts(d.kind, d.end);
      if (dryRun) { results.push({ user_id: d.user_id, kind: d.kind, expires_at: endIso, title, simulation: true }); continue; }

      // Réservation du rappel AVANT l'envoi : deux exécutions simultanées n'envoient qu'une fois.
      const { data: claimed, error: claimErr } = await admin.from("subscription_reminders")
        .insert({ user_id: d.user_id, expires_at: endIso, kind: d.kind, channels: [] })
        .select("id").maybeSingle();
      if (claimErr || !claimed) continue; // déjà réservé par une autre exécution

      const channels: string[] = [];
      const errors: string[] = [];

      const { data: notif, error: nErr } = await admin.from("notifications")
        .insert({ user_id: d.user_id, title, message, type: "subscription" }).select("id").maybeSingle();
      if (nErr) errors.push(`notification : ${nErr.message}`); else channels.push("in_app");

      if (pushOn) {
        try {
          const { data: toks } = await admin.from("device_tokens").select("token").eq("user_id", d.user_id);
          if (toks?.length) {
            if (!fcm) {
              const sa = JSON.parse(Deno.env.get("FCM_SERVICE_ACCOUNT_JSON") ?? "null");
              if (!sa) throw new Error("FCM_SERVICE_ACCOUNT_JSON absente");
              fcm = { projectId: sa.project_id, accessToken: await fcmAccessToken(sa) };
            }
            if (await sendPush(fcm, toks.map((t) => t.token), title, message)) channels.push("push");
          }
        } catch (e) { errors.push(`push : ${e instanceof Error ? e.message : e}`); }
      }

      if (emailOn) {
        try {
          const { data: u } = await admin.auth.admin.getUserById(d.user_id);
          const email = u?.user?.email;
          if (email && u.user.email_confirmed_at) {
            const { data: prof } = await admin.from("user_profiles").select("full_name").eq("user_id", d.user_id).maybeSingle();
            await sendEmail(email, prof?.full_name ?? null, title, message);
            channels.push("email");
          }
        } catch (e) { errors.push(`e-mail : ${e instanceof Error ? e.message : e}`); }
      }

      await admin.from("subscription_reminders")
        .update({ channels, notification_id: notif?.id ?? null, error: errors.length ? errors.join(" · ").slice(0, 1000) : null })
        .eq("id", claimed.id);
      results.push({ user_id: d.user_id, kind: d.kind, expires_at: endIso, channels, errors });
    }

    return json({ success: true, dry_run: dryRun, checked: ends.size, due: due.length, sent: results.length, push: pushOn, email: emailOn, results });
  } catch (e) {
    console.error("subscription-reminders", e);
    return json({ error: e instanceof Error ? e.message : "Erreur serveur" }, 500);
  }
});

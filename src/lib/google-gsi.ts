import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

/**
 * Chargement du script Google Identity Services (bouton « Continuer avec Google » du site).
 * Module léger et séparé : on peut lancer le chargement AVANT d'arriver sur la page Connexion
 * (lien « Se connecter » touché, livre réservé qui demande de se connecter), pour que le bouton
 * apparaisse sans délai. Jamais dans l'application Android (connexion différente).
 */
const GSI_SRC = "https://accounts.google.com/gsi/client";

export type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  cancel: () => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

export let gsiPromise: Promise<GoogleId> | null = null;
// 15 s : laisse le temps au script Google sur une 4G lente avant de basculer sur l'ancien bouton.
export function loadGsi(timeoutMs = 15000): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id);
  if (gsiPromise) return gsiPromise;
  gsiPromise = new Promise<GoogleId>((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("Google indisponible (délai dépassé)")), timeoutMs);
    const done = () => {
      window.clearTimeout(timer);
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error("Google indisponible"));
    };
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", done, { once: true });
      existing.addEventListener("error", () => { window.clearTimeout(timer); reject(new Error("Google indisponible")); }, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = GSI_SRC;
    s.async = true;
    s.defer = true;
    s.onload = done;
    s.onerror = () => { window.clearTimeout(timer); reject(new Error("Google indisponible")); };
    document.head.appendChild(s);
  }).catch((e) => {
    gsiPromise = null; // nouvel essai possible à la prochaine ouverture de la page
    throw e;
  });
  return gsiPromise;
}


/** Démarre le chargement en arrière-plan (sans effet dans l'appli Android ou si déjà chargé). */
export function preloadGoogleSignIn() {
  if (typeof window === "undefined" || Capacitor.isNativePlatform()) return;
  loadGsi().catch(() => { /* la page Connexion réessaiera et basculera sur l'ancien bouton */ });
}

// ─── Secours SANS supabase.co : redirection Google vers NOTRE site ───────────────────────────
// Si le bouton Google direct ne peut pas s'afficher, on n'utilise plus la redirection de Supabase
// (qui affichait « bwepnibdlmuwtcacyyec.supabase.co ») : on demande à Google un jeton d'identité
// renvoyé directement sur https://www.kmgbibliotheque.com/auth (flux « id_token », sans secret).
// Google affiche donc toujours kmgbibliotheque.com. Adresse de retour déclarée dans Google Cloud
// (client « KMG Bibliothèque Web » → URI de redirection autorisés).
const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  "26513992668-2rhbrfriu34mvkhov51q1ahehrrk48ng.apps.googleusercontent.com";
const REDIRECT_KEY = "kmg-google-redirect";

function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function sha256Hex(text: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Envoie le visiteur chez Google ; il revient sur /auth avec un jeton d'identité. */
export async function startGoogleRedirect() {
  const state = randomHex(16);
  const rawNonce = randomHex(32);
  try {
    sessionStorage.setItem(REDIRECT_KEY, JSON.stringify({ state, rawNonce, t: Date.now() }));
  } catch { /* sans stockage, le retour sera refusé proprement */ }
  const params = new URLSearchParams({
    client_id: GOOGLE_WEB_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth`,
    response_type: "id_token",
    scope: "openid email profile",
    nonce: await sha256Hex(rawNonce),
    state,
    prompt: "select_account",
  });
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}

/**
 * Au retour de Google sur /auth : vérifie l'état anti-falsification puis ouvre la session.
 * Renvoie null s'il n'y a rien à traiter, sinon un message d'erreur ou "" en cas de succès.
 */
export async function completeGoogleRedirect(): Promise<string | null> {
  const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
  if (!hash || !/(^|&)(id_token|error)=/.test(hash)) return null;
  const p = new URLSearchParams(hash);
  // On efface tout de suite le jeton de la barre d'adresse.
  window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
  let saved: { state?: string; rawNonce?: string; t?: number } = {};
  try {
    saved = JSON.parse(sessionStorage.getItem(REDIRECT_KEY) || "{}");
    sessionStorage.removeItem(REDIRECT_KEY);
  } catch { /* rien */ }
  if (p.get("error")) return p.get("error") === "access_denied" ? "" : "Connexion Google annulée ou refusée.";
  const idToken = p.get("id_token");
  if (!idToken || !saved.state || p.get("state") !== saved.state || !saved.rawNonce) {
    return "La connexion Google n'a pas pu être vérifiée. Réessayez.";
  }
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: saved.rawNonce });
  return error ? "Erreur de connexion avec Google. Réessayez." : "";
}

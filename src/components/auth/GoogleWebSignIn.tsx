import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Connexion Google « directe » sur le site (Google Identity Services).
 *
 * Pourquoi : avec la redirection classique, la fenêtre Google affichait l'adresse technique de la
 * base (« Accéder à l'application bwepnibdlmuwtcacyyec.supabase.co »). Ici, la fenêtre Google
 * s'ouvre au nom du site (kmgbibliotheque.com) : Google renvoie un jeton d'identité signé, que
 * Supabase vérifie lui-même (signInWithIdToken), avec un nonce anti-rejeu.
 *
 * Si le script de Google ne se charge pas (réseau, bloqueur, navigateur ancien), `onUnavailable`
 * est appelé : la page réaffiche l'ancien bouton (redirection), personne ne reste bloqué.
 */

// Identifiant PUBLIC du client OAuth « KMG Bibliothèque Web » (projet Google Cloud kmg-bibliotheque),
// le même que celui configuré dans Supabase → Authentification → Google.
const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  "26513992668-2rhbrfriu34mvkhov51q1ahehrrk48ng.apps.googleusercontent.com";

const GSI_SRC = "https://accounts.google.com/gsi/client";

type GsiCredential = { credential?: string };
type GoogleId = {
  initialize: (o: Record<string, unknown>) => void;
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
  cancel: () => void;
};
declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let gsiPromise: Promise<GoogleId> | null = null;
function loadGsi(timeoutMs = 8000): Promise<GoogleId> {
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

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomNonce(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Props {
  onError: (message: string) => void;
  onUnavailable: () => void;
  onBusyChange?: (busy: boolean) => void;
}

export function GoogleWebSignIn({ onError, onUnavailable, onBusyChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const gsi = await loadGsi();
        if (cancelled || !containerRef.current) return;
        // Nonce : Google l'inscrit (haché) dans le jeton ; Supabase vérifie la correspondance.
        const rawNonce = randomNonce();
        const hashedNonce = await sha256Hex(rawNonce);
        gsi.initialize({
          client_id: GOOGLE_WEB_CLIENT_ID,
          nonce: hashedNonce,
          ux_mode: "popup",
          auto_select: false,
          cancel_on_tap_outside: true,
          itp_support: true,
          use_fedcm_for_button: true,
          callback: async ({ credential }: GsiCredential) => {
            if (!credential) {
              onError("Connexion Google annulée.");
              return;
            }
            onBusyChange?.(true);
            const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: credential, nonce: rawNonce });
            onBusyChange?.(false);
            if (error) {
              console.warn("[google] signInWithIdToken", error.message);
              onError("La connexion directe avec Google n'a pas abouti. Réessayez avec le bouton ci-dessous.");
              onUnavailable(); // l'ancien bouton (redirection) prend le relais
            }
            // Succès : la session est enregistrée ; la page Connexion redirige d'elle-même vers le profil.
          },
        });
        const width = Math.max(220, Math.min(400, Math.floor(containerRef.current.getBoundingClientRect().width || 320)));
        gsi.renderButton(containerRef.current, {
          type: "standard",
          theme: "outline",
          size: "large",
          text: "continue_with",
          shape: "rectangular",
          logo_alignment: "center",
          locale: "fr",
          width,
        });
        if (!cancelled) setReady(true);
      } catch (e) {
        console.warn("[google] bouton direct indisponible, retour à la redirection", e);
        if (!cancelled) onUnavailable();
      }
    })();
    return () => {
      cancelled = true;
      try { window.google?.accounts?.id?.cancel(); } catch { /* rien */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full flex justify-center min-h-[44px]">
      <div ref={containerRef} className="w-full flex justify-center" aria-busy={!ready} />
    </div>
  );
}

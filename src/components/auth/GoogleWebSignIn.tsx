import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadGsi } from "@/lib/google-gsi";

type GsiCredential = { credential?: string };

/**
 * Note (sans donnée personnelle) qu'un visiteur a dû utiliser l'ancien bouton Google : permet de
 * savoir si cela arrive souvent (connexion lente, navigateur ancien…). Table client_events.
 */
function logFallback(reason: string) {
  try {
    void (supabase.from("client_events" as never) as unknown as {
      insert: (row: Record<string, string>) => Promise<unknown>;
    }).insert({
      kind: "google_gsi_fallback",
      reason: reason.slice(0, 200),
      user_agent: (navigator.userAgent || "").slice(0, 300),
    });
  } catch { /* diagnostic seulement */ }
}

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
              logFallback(`signInWithIdToken: ${error.message}`);
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
        if (!cancelled) {
          logFallback(e instanceof Error ? e.message : String(e));
          onUnavailable();
        }
      }
    })();
    return () => {
      cancelled = true;
      try { window.google?.accounts?.id?.cancel(); } catch { /* rien */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative w-full flex justify-center min-h-[44px]">
      {!ready && (
        // Même taille que le bouton Google : pas d'espace vide pendant le chargement.
        <div className="absolute inset-0 flex items-center justify-center gap-2 rounded-md border border-border bg-card text-sm font-medium text-muted-foreground" aria-hidden>
          <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
          Continuer avec Google
        </div>
      )}
      <div ref={containerRef} className={`w-full flex justify-center ${ready ? "" : "opacity-0"}`} aria-busy={!ready} />
    </div>
  );
}

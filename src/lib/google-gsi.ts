import { Capacitor } from "@capacitor/core";

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

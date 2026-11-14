import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/** Feuilles de styles du site chargées sans bloquer (voir le plugin kmg-splash-first de vite.config.ts). */
function siteStylesReady(): boolean {
  const links = Array.from(document.querySelectorAll<HTMLLinkElement>("link[data-kmg-css]"));
  // Aucune (mode développement : styles injectés par le script) → rien à attendre.
  return links.every((l) => l.rel === "stylesheet" && !!l.sheet);
}

/**
 * Écran de démarrage (logo KMG) : affiché par index.html dès la première fraction de seconde, puis
 * retiré en fondu quand la page est réellement affichée (en-tête ou contenu principal présent, ou
 * page assez haute) ET que la feuille de styles du site est chargée. Dans l'appli Android, l'écran
 * de démarrage natif est retiré au même moment. Le fond bleu nuit de démarrage (classe kmg-booting
 * sur <html>) est retiré en même temps. Limite de sécurité : 8 s.
 */
export function hideAppSplashWhenReady() {
  if (typeof document === "undefined") return;
  const splash = document.getElementById("app-splash");
  const root = document.getElementById("root");
  let done = false;
  let observer: MutationObserver | null = null;

  const hide = () => {
    if (done) return;
    done = true;
    observer?.disconnect();
    window.clearTimeout(safety);
    window.clearInterval(poll);
    // Sécurité : une feuille encore en préchargement est appliquée quoi qu'il arrive.
    document.querySelectorAll<HTMLLinkElement>("link[data-kmg-css]").forEach((l) => {
      if (l.rel !== "stylesheet") l.rel = "stylesheet";
    });
    document.documentElement.classList.remove("kmg-booting");
    if (Capacitor.isNativePlatform()) SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
    if (!splash) return;
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    window.setTimeout(() => splash.remove(), 300);
  };

  const ready = () =>
    !!root &&
    (root.querySelector("header, main") !== null || root.offsetHeight > window.innerHeight * 0.5) &&
    siteStylesReady();

  // Deux images d'affichage après l'apparition du contenu : il est peint avant le fondu.
  let scheduled = false;
  const check = () => {
    if (done || scheduled || !ready()) return;
    scheduled = true;
    requestAnimationFrame(() => requestAnimationFrame(hide));
  };

  const safety = window.setTimeout(hide, 8000);
  // La fin du chargement des styles ne modifie pas #root : vérification régulière en plus.
  const poll = window.setInterval(check, 100);
  if (root) {
    observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true });
  }
  check();
}

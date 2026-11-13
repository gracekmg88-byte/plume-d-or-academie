import { Capacitor } from "@capacitor/core";
import { SplashScreen } from "@capacitor/splash-screen";

/**
 * Écran de démarrage (logo KMG) : affiché par index.html dès la première fraction de seconde, puis
 * retiré en fondu quand la page est réellement affichée (en-tête ou contenu principal présent, ou
 * page assez haute). Dans l'appli Android, l'écran de démarrage natif est retiré au même moment.
 * Limite de sécurité : 8 s.
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
    if (Capacitor.isNativePlatform()) SplashScreen.hide({ fadeOutDuration: 200 }).catch(() => {});
    if (!splash) return;
    splash.style.opacity = "0";
    splash.style.pointerEvents = "none";
    window.setTimeout(() => splash.remove(), 300);
  };

  const ready = () =>
    !!root && (root.querySelector("header, main") !== null || root.offsetHeight > window.innerHeight * 0.5);

  // Deux images d'affichage après l'apparition du contenu : il est peint avant le fondu.
  const check = () => {
    if (!done && ready()) requestAnimationFrame(() => requestAnimationFrame(hide));
  };

  const safety = window.setTimeout(hide, 8000);
  if (root) {
    observer = new MutationObserver(check);
    observer.observe(root, { childList: true, subtree: true });
  }
  check();
}

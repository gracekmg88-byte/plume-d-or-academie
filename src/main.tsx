import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

const CACHE_RESET_RELOAD_FLAG = "plume-cache-reset-reload-done";
const APP_RUNTIME_VERSION = "2026-05-28-02";
const RUNTIME_VERSION_KEY = "plume-runtime-version";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

const normalizedCurrentUrl = () => {
  const url = new URL(window.location.href);
  url.searchParams.delete("sw-cleanup");
  return url.toString();
};

const forceFreshReloadOnce = (flag: string) => {
  if (sessionStorage.getItem(flag) === "1") return;
  sessionStorage.setItem(flag, "1");
  window.location.replace(normalizedCurrentUrl());
};

const clearBrowserCaches = async () => {
  if (!("caches" in window)) return false;

  const cacheNames = await caches.keys();
  if (!cacheNames.length) return false;

  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  return true;
};

const hasRuntimeVersionChanged = () => {
  try {
    return localStorage.getItem(RUNTIME_VERSION_KEY) !== APP_RUNTIME_VERSION;
  } catch {
    return false;
  }
};

const markRuntimeVersion = () => {
  try {
    localStorage.setItem(RUNTIME_VERSION_KEY, APP_RUNTIME_VERSION);
  } catch {
    // ignore version mark failures during boot
  }
};

const clearVersionedStorage = () => {
  try {
    const storageKeys = ["vite:cache-buster"];

    for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
      const key = sessionStorage.key(i);
      if (key && storageKeys.some((prefix) => key.startsWith(prefix))) {
        sessionStorage.removeItem(key);
      }
    }
  } catch {
    // ignore storage cleanup failures during boot
  }
};

const cleanupLegacyRuntime = async () => {
  let removedRegistration = false;
  let clearedCaches = false;
  const runtimeChanged = hasRuntimeVersionChanged();

  if (runtimeChanged) {
    clearVersionedStorage();
  }

  if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map(async (registration) => {
          const url = registration.active?.scriptURL ?? registration.waiting?.scriptURL ?? registration.installing?.scriptURL ?? "";
          const isLegacyAppWorker = url.includes("/sw.js") || url.includes("/service-worker.js") || url.includes("workbox");
          const shouldUnregister = isPreviewHost || isInIframe || isLegacyAppWorker || Boolean(url);

          if (shouldUnregister) {
            const removed = await registration.unregister();
            removedRegistration = removedRegistration || removed;
          }
        }),
      );
    } catch {
      // ignore cleanup failures during boot
    }
  }

  try {
    clearedCaches = await clearBrowserCaches();
  } catch {
    // ignore cache cleanup failures during boot
  }

  const hadCleanupQuery = new URL(window.location.href).searchParams.has("sw-cleanup");
  if (hadCleanupQuery) {
    window.history.replaceState(window.history.state, "", normalizedCurrentUrl());
  }

  markRuntimeVersion();

  if (removedRegistration || clearedCaches || hadCleanupQuery) {
    forceFreshReloadOnce(CACHE_RESET_RELOAD_FLAG);
  }
};

void cleanupLegacyRuntime();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

import { useState, useEffect } from "react";
import { X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869";
const DISMISSED_KEY = "app-download-banner-dismissed";

export function AppDownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Only show on web browsers, not in installed PWA or Capacitor
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window as any).Capacitor?.isNativePlatform?.();
    const dismissed = localStorage.getItem(DISMISSED_KEY);

    if (!isStandalone && !dismissed) {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  return (
    <div className="bg-primary text-primary-foreground px-4 py-2.5 flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2 min-w-0">
        <Smartphone className="h-4 w-4 shrink-0" />
        <span className="truncate">
          Téléchargez l'application <strong>KMG Bibliothèque</strong> pour une meilleure navigation
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs font-semibold"
          asChild
        >
          <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer">
            Télécharger
          </a>
        </Button>
        <button
          onClick={dismiss}
          className="p-1 rounded-full hover:bg-primary-foreground/20 transition-colors"
          aria-label="Fermer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

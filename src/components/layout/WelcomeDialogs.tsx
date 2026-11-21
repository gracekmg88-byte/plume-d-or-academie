import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ShieldCheck, Smartphone } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { isSearchBot } from "@/lib/is-bot";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869";
const PRIVACY_KEY = "kmg-privacy-accepted-v1";
const APP_INVITE_KEY = "kmg-app-invite-v1"; // "installed-clicked" ou date (ms) du dernier « Plus tard »
const APP_INVITE_SNOOZE_MS = 7 * 24 * 60 * 60 * 1000; // « Plus tard » : de nouveau dans 7 jours

// Pages où l'on n'interrompt pas la personne : administration, vérification d'un certificat
// (souvent ouverte en scannant un QR code) et la page Confidentialité elle-même.
const QUIET_PATHS = [/^\/admin/, /^\/verify\//, /^\/verification/, /^\/confidentialite/];

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeKey(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // stockage bloqué (navigation privée) : le message reviendra à la prochaine visite, sans gravité
  }
}

/** Navigateur d'un téléphone/tablette Android, hors appli installée. */
function isAndroidBrowser(): boolean {
  if (Capacitor.isNativePlatform()) return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return false;
  return /Android/i.test(navigator.userAgent);
}

function shouldInviteToApp(): boolean {
  if (!isAndroidBrowser()) return false;
  const v = readKey(APP_INVITE_KEY);
  if (v === "installed-clicked") return false;
  const last = Number(v) || 0;
  return Date.now() - last > APP_INVITE_SNOOZE_MS;
}

/** Attend la fin de l'écran de démarrage (logo) avant d'afficher quoi que ce soit. */
function useSplashGone(): boolean {
  const [gone, setGone] = useState(() => !document.getElementById("app-splash"));
  useEffect(() => {
    if (gone) return;
    const timer = window.setInterval(() => {
      if (!document.getElementById("app-splash")) {
        window.clearInterval(timer);
        setGone(true);
      }
    }, 200);
    return () => window.clearInterval(timer);
  }, [gone]);
  return gone;
}

/**
 * 1re visite : bandeau « respect de la vie privée » en bas de l'écran (à accepter une fois par
 * appareil). Ce n'est plus une fenêtre par-dessus la page : le contenu reste visible et lisible
 * (meilleur sur téléphone, et Google ne prend plus la page pour une page vide).
 * Aucun message n'est montré aux robots des moteurs de recherche (src/lib/is-bot.ts).
 * Ensuite, sur un navigateur Android : invitation à installer l'appli depuis Google Play
 * (« Plus tard » = de nouveau dans 7 jours ; « Télécharger » = plus jamais).
 */
export function WelcomeDialogs() {
  // Calculé une seule fois : la signature du navigateur ne change pas pendant la visite.
  const [bot] = useState(() => isSearchBot());
  if (bot) return null;
  return <WelcomeMessages />;
}

function WelcomeMessages() {
  const { t } = useLanguage();
  const { pathname } = useLocation();
  const splashGone = useSplashGone();
  const [privacyAccepted, setPrivacyAccepted] = useState(() => readKey(PRIVACY_KEY) !== null);
  const [appInviteOpen, setAppInviteOpen] = useState(false);
  const [appInviteDone, setAppInviteDone] = useState(false);

  const quiet = QUIET_PATHS.some((re) => re.test(pathname));
  const privacyOpen = splashGone && !quiet && !privacyAccepted;

  // Invitation à l'appli : une seule fois par visite, un court instant après le message d'accueil.
  useEffect(() => {
    if (!splashGone || quiet || !privacyAccepted || appInviteDone || appInviteOpen) return;
    if (!shouldInviteToApp()) {
      setAppInviteDone(true);
      return;
    }
    const timer = window.setTimeout(() => setAppInviteOpen(true), 800);
    return () => window.clearTimeout(timer);
  }, [splashGone, quiet, privacyAccepted, appInviteDone, appInviteOpen]);

  const acceptPrivacy = () => {
    writeKey(PRIVACY_KEY, new Date().toISOString());
    setPrivacyAccepted(true);
  };

  const closeAppInvite = (choice: "download" | "later") => {
    writeKey(APP_INVITE_KEY, choice === "download" ? "installed-clicked" : String(Date.now()));
    setAppInviteOpen(false);
    setAppInviteDone(true);
  };

  return (
    <>
      {privacyOpen && (
        <section
          role="region"
          aria-label={t("welcome.privacyTitle")}
          className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in slide-in-from-bottom-4 fade-in duration-300"
        >
          <div className="mx-auto max-w-3xl max-h-[40dvh] overflow-y-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-2xl p-3.5 sm:p-5">
            <div className="flex items-start gap-3">
              <img src="/kmg-logo-256.webp" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-xl shadow-sm" />
              <div className="min-w-0 space-y-1.5">
                <p className="font-serif text-base font-semibold leading-snug text-foreground">{t("welcome.privacyTitle")}</p>
                <p className="text-sm text-muted-foreground leading-relaxed">{t("welcome.privacyIntro")}</p>
                <p className="flex items-start gap-2 text-sm font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  <span>{t("welcome.privacyNoAds")}</span>
                </p>
              </div>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:justify-end">
              <Button variant="outline" asChild className="h-10 px-2 sm:w-auto sm:px-4">
                <Link to="/confidentialite">{t("welcome.learnMore")}</Link>
              </Button>
              <Button onClick={acceptPrivacy} className="h-10 px-2 font-semibold sm:w-auto sm:px-4">
                {t("welcome.accept")}
              </Button>
            </div>
          </div>
        </section>
      )}

      <Dialog open={appInviteOpen} onOpenChange={(open) => { if (!open) closeAppInvite("later"); }}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-sm rounded-2xl">
          <DialogHeader className="items-center text-center sm:text-center">
            <div className="relative">
              <img src="/kmg-logo-256.webp" alt="" width={72} height={72} className="h-[72px] w-[72px] rounded-2xl shadow-md" />
              <Smartphone className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-primary p-1 text-primary-foreground" />
            </div>
            <DialogTitle className="font-serif text-xl leading-snug pt-2">{t("welcome.appTitle")}</DialogTitle>
            <DialogDescription className="text-sm">{t("welcome.appText")}</DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <Button asChild className="w-full h-11 font-semibold">
              <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" onClick={() => closeAppInvite("download")}>
                {t("welcome.appDownload")}
              </a>
            </Button>
            <Button variant="ghost" className="w-full h-11" onClick={() => closeAppInvite("later")}>
              {t("welcome.appLater")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

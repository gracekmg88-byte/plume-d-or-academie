import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { ShieldCheck, Smartphone } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
 * 1re visite : message « respect de la vie privée » (à accepter une fois par appareil).
 * Ensuite, sur un navigateur Android : invitation à installer l'appli depuis Google Play
 * (« Plus tard » = de nouveau dans 7 jours ; « Télécharger » = plus jamais).
 */
export function WelcomeDialogs() {
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
      <AlertDialog open={privacyOpen}>
        <AlertDialogContent className="max-h-[90dvh] overflow-y-auto w-[calc(100%-2rem)] max-w-md rounded-2xl">
          <AlertDialogHeader className="items-center text-center sm:text-center">
            <img src="/kmg-logo-256.webp" alt="" width={64} height={64} className="h-16 w-16 rounded-2xl shadow-md" />
            <AlertDialogTitle className="font-serif text-xl leading-snug pt-2">
              {t("welcome.privacyTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3 text-left text-sm text-muted-foreground pt-1">
                <p>{t("welcome.privacyIntro")}</p>
                <p>{t("welcome.privacyAccount")}</p>
                <p className="flex items-start gap-2 font-medium text-foreground">
                  <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-emerald-600" />
                  <span>{t("welcome.privacyNoAds")}</span>
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            <AlertDialogAction onClick={acceptPrivacy} className="w-full h-11 font-semibold uppercase tracking-wide">
              {t("welcome.accept")}
            </AlertDialogAction>
            <Button variant="outline" asChild className="w-full h-11">
              <Link to="/confidentialite">{t("welcome.learnMore")}</Link>
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

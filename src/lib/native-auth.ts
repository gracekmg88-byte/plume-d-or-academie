/**
 * Connexion OAuth (Google) dans l'appli Android (Capacitor).
 *
 * Dans l'appli, window.location.origin vaut https://localhost : ce n'est pas une adresse que
 * le navigateur peut rejoindre. Le flux est donc :
 *   1. l'appli demande l'URL Google à Supabase (skipBrowserRedirect, flux PKCE) ;
 *   2. la page Google s'ouvre dans un onglet sécurisé (Custom Tab, @capacitor/browser) ;
 *   3. Supabase renvoie vers le schéma de l'appli (NATIVE_AUTH_CALLBACK), déclaré dans
 *      android/app/src/main/AndroidManifest.xml ;
 *   4. Android rouvre l'appli, qui échange le code à usage unique contre la session.
 *
 * Sur le site web, rien de tout cela ne s'applique (isNativeApp() === false).
 */
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { supabase } from "@/integrations/supabase/client";

/** Doit figurer dans les « Redirect URLs » de Supabase Auth et dans l'intent-filter Android. */
export const NATIVE_AUTH_CALLBACK = "app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869://auth-callback";

/** Événement émis si le retour de Google contient une erreur (affiché par la page de connexion). */
export const NATIVE_AUTH_ERROR_EVENT = "kmg-native-auth-error";

const SITE_URL = (import.meta.env.VITE_SITE_URL || "https://www.kmgbibliotheque.com").replace(/\/+$/, "");

export const isNativeApp = (): boolean => Capacitor.isNativePlatform();

/**
 * Base des liens envoyés par e-mail (confirmation d'inscription, réinitialisation du mot de passe).
 * Dans l'appli : le site public (le lien s'ouvre dans le navigateur). Sur le web : l'origine actuelle.
 */
export function authLinkBaseUrl(): string {
  return isNativeApp() ? SITE_URL : window.location.origin;
}

// ─── Connexion Google NATIVE (Android, Credential Manager) ───────────────────────────────
// La fenêtre Google du téléphone s'ouvre au nom « KMG Bibliothèque » (et non plus sur l'adresse
// technique de la base). Google renvoie un jeton d'identité que Supabase vérifie (signInWithIdToken),
// avec un nonce anti-rejeu. Clients OAuth Android déclarés dans Google Cloud (projet kmg-bibliotheque) :
// package app.lovable.d11bc5d4512e4b5f9f8a79e7ee7ad869 + SHA-1 de la clé Play et de la clé d'importation.
const GOOGLE_WEB_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID as string | undefined) ||
  "26513992668-2rhbrfriu34mvkhov51q1ahehrrk48ng.apps.googleusercontent.com";

/** Annulation volontaire (fenêtre Google fermée) : pas d'erreur à afficher, pas de méthode de secours. */
export class GoogleSignInCancelled extends Error {}

let socialLoginReady: Promise<typeof import("@capgo/capacitor-social-login").SocialLogin> | null = null;
function getSocialLogin() {
  if (!socialLoginReady) {
    socialLoginReady = import("@capgo/capacitor-social-login").then(async ({ SocialLogin }) => {
      await SocialLogin.initialize({
        google: {
          webClientId: GOOGLE_WEB_CLIENT_ID,
          mode: "online",
          // Seule l'identité nous intéresse (pas d'API Google) : évite un blocage connu sur BridgeActivity.
          skipAuthOnlyAuthorizationAfterSignIn: true,
        },
      });
      return SocialLogin;
    }).catch((e) => {
      socialLoginReady = null;
      throw e;
    });
  }
  return socialLoginReady;
}

async function sha256Hex(text: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function signInWithGoogleCredentialManager(): Promise<void> {
  const SocialLogin = await getSocialLogin();
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  const rawNonce = [...raw].map((b) => b.toString(16).padStart(2, "0")).join("");
  let idToken: string | null | undefined;
  try {
    const res = await SocialLogin.login({
      provider: "google",
      options: { nonce: await sha256Hex(rawNonce), style: "bottom", filterByAuthorizedAccounts: false, autoSelectEnabled: false },
    });
    idToken = (res.result as { idToken?: string | null }).idToken;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/cancel|annul|dismiss/i.test(msg) || /(^|[^0-9])16([^0-9]|$)/.test(msg)) throw new GoogleSignInCancelled(msg);
    throw e;
  }
  if (!idToken) throw new Error("Google n'a pas renvoyé de jeton d'identité");
  const { error } = await supabase.auth.signInWithIdToken({ provider: "google", token: idToken, nonce: rawNonce });
  if (error) throw error;
  // Succès : onAuthStateChange (useAuth) met à jour l'utilisateur ; la page de connexion redirige.
}

/**
 * Connexion Google dans l'appli : d'abord la fenêtre native du téléphone ; en cas d'échec
 * technique (pas de compte Google sur l'appareil, services Google indisponibles…), repli
 * automatique sur l'ancienne méthode (onglet sécurisé). Une annulation n'entraîne pas de repli.
 */
export async function signInWithGoogleNative(): Promise<void> {
  try {
    await signInWithGoogleCredentialManager();
    return;
  } catch (e) {
    if (e instanceof GoogleSignInCancelled) throw e;
    console.warn("[native-auth] connexion Google native indisponible, repli sur l'onglet sécurisé", e);
  }
  await signInWithGoogleCustomTab();
}

/** Ancienne méthode (secours) : onglet sécurisé ; la suite arrive par handleCallbackUrl. */
async function signInWithGoogleCustomTab(): Promise<void> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: NATIVE_AUTH_CALLBACK, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("Adresse de connexion Google manquante");
  await Browser.open({ url: data.url });
}

const handledUrls = new Set<string>();

function reportError(message: string) {
  console.error("[native-auth]", message);
  window.dispatchEvent(new CustomEvent(NATIVE_AUTH_ERROR_EVENT, { detail: message }));
}

async function handleCallbackUrl(url: string): Promise<void> {
  if (!url || !url.startsWith(NATIVE_AUTH_CALLBACK)) return;
  // Le même retour peut arriver deux fois (appUrlOpen + getLaunchUrl) : un code ne s'échange qu'une fois.
  if (handledUrls.has(url)) return;
  handledUrls.add(url);

  try {
    await Browser.close();
  } catch {
    // Sur Android, l'onglet se ferme déjà quand l'appli (launchMode singleTask) revient au premier plan.
  }

  let params: URLSearchParams;
  try {
    params = new URL(url).searchParams;
  } catch {
    reportError("Adresse de retour illisible");
    return;
  }

  const providerError = params.get("error_description") || params.get("error");
  if (providerError) {
    reportError(providerError);
    return;
  }

  const code = params.get("code");
  if (!code) {
    reportError("Code de connexion absent du retour");
    return;
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) reportError(error.message);
  // En cas de succès, onAuthStateChange (useAuth) met à jour l'utilisateur et la page de connexion redirige.
}

let started = false;

/** À appeler une fois au démarrage. Sans effet sur le site web. */
export function initNativeAuth(): void {
  if (started || !isNativeApp()) return;
  started = true;

  void App.addListener("appUrlOpen", ({ url }) => {
    void handleCallbackUrl(url);
  });

  // Appli relancée directement par le retour (processus arrêté pendant la connexion).
  App.getLaunchUrl()
    .then((result) => {
      if (result?.url) void handleCallbackUrl(result.url);
    })
    .catch(() => {});
}

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

/** Ouvre la connexion Google dans un onglet sécurisé ; la suite arrive par handleCallbackUrl. */
export async function signInWithGoogleNative(): Promise<void> {
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

import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import type { Database } from './types';

// Appli Android (Capacitor) : flux PKCE. Le retour OAuth arrive par le schéma de l'appli
// avec un code à usage unique, échangé contre la session (voir src/lib/native-auth.ts).
// Site web : flux implicite inchangé (les liens e-mail restent utilisables sur un autre appareil).
const IS_NATIVE = Capacitor.isNativePlatform();

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  // Échec explicite plutôt qu'un site vide si les variables de build manquent.
  throw new Error("VITE_SUPABASE_URL et VITE_SUPABASE_PUBLISHABLE_KEY doivent être définies au build.");
}

// Tolérance à une horloge d'appareil déréglée (fuseau horaire faux, heure réglée à la main…).
// Le serveur renvoie l'instant absolu d'expiration (expires_at) ; si l'horloge locale est en avance
// d'environ une heure, chaque session paraît déjà expirée et le client la renouvelle en boucle,
// puis déconnecte l'utilisateur. On recalcule donc expires_at à partir de la durée de validité
// (expires_in) et de l'horloge locale. La validité réelle reste contrôlée par le serveur.
const AUTH_TOKEN_URL = `${SUPABASE_URL}/auth/v1/token`;

const skewTolerantFetch: typeof fetch = async (input, init) => {
  const response = await fetch(input, init);
  try {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!response.ok || !url.startsWith(AUTH_TOKEN_URL)) return response;
    const data = await response.clone().json();
    if (!data || typeof data.access_token !== 'string' || typeof data.expires_in !== 'number') return response;
    data.expires_at = Math.floor(Date.now() / 1000) + data.expires_in;
    const headers = new Headers(response.headers);
    headers.delete('content-length');
    headers.delete('content-encoding');
    return new Response(JSON.stringify(data), { status: response.status, statusText: response.statusText, headers });
  } catch {
    return response;
  }
};

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    persistSession: true,
    autoRefreshToken: true,
    // Dans l'appli, la session n'arrive jamais dans l'URL de la WebView : c'est native-auth.ts qui l'échange.
    detectSessionInUrl: !IS_NATIVE,
    flowType: IS_NATIVE ? 'pkce' : 'implicit',
  },
  global: { fetch: skewTolerantFetch },
});

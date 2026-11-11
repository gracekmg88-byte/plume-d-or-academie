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
  }
});

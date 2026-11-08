// Configuration partagée des scripts de build (sitemap, prérendu).
// Lit les variables d'environnement, puis complète depuis .env.local / .env
// (comme Vite) pour que `npm run build` fonctionne en local comme en CI.

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";

function loadDotEnv(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const file of [".env", ".env.local", ".env.production", ".env.production.local"]) {
    const p = resolve(file);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

const fileEnv = loadDotEnv();
const get = (k: string) => process.env[k] || fileEnv[k] || "";

export const SITE_URL = (get("VITE_SITE_URL") || "https://www.kmgbibliotheque.com").replace(/\/+$/, "");
export const SUPABASE_URL = get("VITE_SUPABASE_URL").replace(/\/+$/, "");
export const SUPABASE_ANON = get("VITE_SUPABASE_PUBLISHABLE_KEY");

/** true si les scripts peuvent interroger la base ; sinon ils produisent une sortie minimale. */
export const HAS_SUPABASE = Boolean(SUPABASE_URL && SUPABASE_ANON);
if (!HAS_SUPABASE) {
  console.warn("[build-env] VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY absentes : pages dynamiques non générées.");
}

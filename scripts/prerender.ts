// Prérendu : génère un fichier HTML statique par publication et par auteur après `vite build`
// (hook postbuild). Chaque fichier contient le <head> complet (title, description, canonical,
// Open Graph, Twitter, JSON-LD) et le contenu de la fiche dans #root, lisible par Google avant
// l'exécution du JavaScript. React remplace ensuite ce contenu en montant l'application.
//
// Fichiers écrits en `<chemin>.html` (ex. dist/livre/mon-titre-ab12cd.html) : Cloudflare Pages
// les sert directement à l'adresse canonique `/livre/mon-titre-ab12cd`, SANS redirection.
// (L'ancien format `<chemin>/index.html` provoquait une redirection 308 vers `<chemin>/`.)
//
// Ces pages servent aussi de secours : en ligne, les Pages Functions (dossier functions/)
// rendent les mêmes fiches à la demande, à partir des données à jour.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

import { SUPABASE_URL, SUPABASE_ANON, HAS_SUPABASE } from "./build-env";
import {
  AUTHOR_PROFILE_COLUMNS,
  PUBLICATION_SEO_COLUMNS,
  authorSeo,
  groupByAuthor,
  publicationSeo,
  renderSeoHtml,
  type SeoAuthorProfile,
  type SeoPublication,
} from "../src/seo/pageSeo";
import { STATIC_PAGES, staticPageSeo } from "../src/seo/staticPages";

// Garde-fou : ne jamais dépasser les limites de fichiers de la plateforme.
const MAX_PRERENDER_PAGES = Number(process.env.MAX_PRERENDER_PAGES || 5000);

const DIST = resolve("dist");
const TEMPLATE_PATH = resolve(DIST, "index.html");

async function fetchPublications(): Promise<SeoPublication[]> {
  if (!HAS_SUPABASE) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/publications?select=${PUBLICATION_SEO_COLUMNS}&is_published=eq.true&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) {
      console.warn(`[prerender] lecture des publications impossible : ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn("[prerender] erreur réseau", err);
    return [];
  }
}

function writePage(path: string, html: string) {
  const out = resolve(DIST, `.${path}.html`);
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
}

/** Profils auteurs (biographie, photo) — facultatifs : table absente ou erreur → liste vide. */
async function fetchAuthorProfiles(): Promise<SeoAuthorProfile[]> {
  if (!HAS_SUPABASE) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/authors?select=${AUTHOR_PROFILE_COLUMNS}&limit=10000`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.warn(`[prerender] profils auteurs indisponibles : ${res.status}`);
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}

(async () => {
  if (!existsSync(TEMPLATE_PATH)) {
    console.warn("[prerender] dist/index.html introuvable — étape ignorée.");
    return;
  }
  const template = readFileSync(TEMPLATE_PATH, "utf-8");
  const pubs = await fetchPublications();
  if (pubs.length === 0) {
    console.warn("[prerender] aucune publication — étape ignorée.");
    return;
  }

  let count = 0;
  for (const p of pubs) {
    if (count >= MAX_PRERENDER_PAGES) break;
    const page = publicationSeo(p);
    writePage(page.path, renderSeoHtml(template, page));
    count++;
  }

  // Pages fixes (secours si le rendu à la demande des Functions échoue). L'accueil n'est pas écrit :
  // dist/index.html doit rester le gabarit de l'application.
  for (const path of Object.keys(STATIC_PAGES)) {
    if (path === "/") continue;
    writePage(path, renderSeoHtml(template, staticPageSeo(path, pubs)!));
    count++;
  }

  const profiles = new Map((await fetchAuthorProfiles()).map((p) => [p.slug, p]));
  const authors = groupByAuthor(pubs);
  for (const [slug, { name, pubs: list }] of authors.entries()) {
    if (count >= MAX_PRERENDER_PAGES) break;
    const page = authorSeo(name, list, profiles.get(slug));
    writePage(page.path, renderSeoHtml(template, page));
    count++;
  }

  console.log(`[prerender] ${count} pages HTML générées (${pubs.length} publications, ${authors.size} auteurs).`);
})();

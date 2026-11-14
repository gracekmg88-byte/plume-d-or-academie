// Génère public/sitemap.xml au moment du build (predev / prebuild).
// Lit les publications publiées via l'API publique de Supabase (clé publishable, lecture seule).
// Le contenu (pages fixes, fiches, auteurs, images) vient de src/seo/pageSeo.ts, le même module
// que la Pages Function functions/sitemap.xml.ts, qui sert en ligne une version toujours à jour.
// Ce fichier statique reste le secours si Supabase ne répond pas.

import { writeFileSync } from "fs";
import { resolve } from "path";

import { SUPABASE_URL, SUPABASE_ANON, HAS_SUPABASE } from "./build-env";
import { AUTHOR_PROFILE_COLUMNS, PUBLICATION_SEO_COLUMNS, buildSitemapXml, type SeoAuthorProfile, type SeoPublication } from "../src/seo/pageSeo";

async function fetchPublications(): Promise<SeoPublication[]> {
  if (!HAS_SUPABASE) return [];
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/publications?select=${PUBLICATION_SEO_COLUMNS}&is_published=eq.true&order=created_at.desc`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) {
      console.warn(`[sitemap] lecture des publications impossible : ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn("[sitemap] erreur réseau", err);
    return [];
  }
}

/** Profils auteurs (biographie, photo) — facultatifs : table absente ou erreur → liste vide. */
async function fetchAuthorProfiles(): Promise<SeoAuthorProfile[]> {
  if (!HAS_SUPABASE) return [];
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/authors?select=${AUTHOR_PROFILE_COLUMNS}&limit=10000`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` },
    });
    if (!res.ok) {
      console.warn(`[sitemap] profils auteurs indisponibles : ${res.status}`);
      return [];
    }
    return await res.json();
  } catch {
    return [];
  }
}

(async () => {
  const pubs = await fetchPublications();
  const { xml, counts } = buildSitemapXml(pubs, pubs.length ? await fetchAuthorProfiles() : []);
  writeFileSync(resolve("public/sitemap.xml"), xml);
  const total = counts.static + counts.publications + counts.authors;
  console.log(
    `sitemap.xml écrit (${total} adresses : ${counts.static} pages fixes, ${counts.publications} publications, ${counts.authors} auteurs)`,
  );
})();

// Generates public/sitemap.xml at predev/prebuild time.
// Pulls dynamic publication URLs from Supabase via the public REST API
// using the anon key (read-only public publications).

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://plume-d-or-academie.lovable.app";
const SUPABASE_URL = "https://vlqjdszawxtwutuzvskt.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscWpkc3phd3h0d3V0dXp2c2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDM4NjksImV4cCI6MjA4NDA3OTg2OX0.zbFWoYJbXZgdM9lfpOV3-YxZayClpw_Vp8i-cFC_77A";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/bibliotheque", changefreq: "daily", priority: "0.9" },
  { path: "/a-propos", changefreq: "monthly", priority: "0.7" },
  { path: "/contact", changefreq: "monthly", priority: "0.6" },
  { path: "/depot-memoire", changefreq: "monthly", priority: "0.6" },
  { path: "/installer", changefreq: "monthly", priority: "0.5" },
  { path: "/abonnement", changefreq: "monthly", priority: "0.4" },
];

async function fetchPublications(): Promise<Array<{ id: string; updated_at?: string | null }>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/publications?select=id,updated_at&is_published=eq.true`,
      {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      }
    );
    if (!res.ok) {
      console.warn(`[sitemap] publications fetch failed: ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn("[sitemap] publications fetch error", err);
    return [];
  }
}

function buildSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n")
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const pubs = await fetchPublications();
  const dynamic: SitemapEntry[] = pubs.map((p) => ({
    path: `/publication/${p.id}`,
    lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
    changefreq: "monthly",
    priority: "0.8",
  }));
  const all = [...staticEntries, ...dynamic];
  writeFileSync(resolve("public/sitemap.xml"), buildSitemap(all));
  console.log(`sitemap.xml written (${all.length} entries, ${dynamic.length} publications)`);
})();

// Generates public/sitemap.xml at predev/prebuild time.
// Pulls dynamic publication URLs from Supabase via the public REST API
// using the anon key (read-only public publications). Emits SEO-friendly
// slug URLs (/livre/slug, /memoire/slug, etc.) + author pages + image refs.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://www.kmgbibliotheque.com";
const SUPABASE_URL = "https://vlqjdszawxtwutuzvskt.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscWpkc3phd3h0d3V0dXp2c2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDM4NjksImV4cCI6MjA4NDA3OTg2OX0.zbFWoYJbXZgdM9lfpOV3-YxZayClpw_Vp8i-cFC_77A";

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
  imageUrl?: string;
  imageTitle?: string;
}

// --- Slug helpers (kept in sync with src/lib/slug.ts) ---
function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "publication";
}
function idSuffix(id: string): string {
  return (id || "").replace(/-/g, "").slice(0, 6).toLowerCase();
}
function categorySegment(category: string): string {
  const map: Record<string, string> = { livre: "livre", memoire: "memoire", tfc: "tfc", article: "article" };
  return map[category] || "publication";
}
function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
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

interface PubRow {
  id: string;
  title: string;
  author: string;
  category: string;
  cover_image_url: string | null;
  updated_at?: string | null;
}

async function fetchPublications(): Promise<PubRow[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/publications?select=id,title,author,category,cover_image_url,updated_at&is_published=eq.true`,
      {
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
      },
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
  const hasImages = entries.some((e) => e.imageUrl);
  const ns = hasImages
    ? `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`
    : `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`;

  const urls = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${escapeXml(BASE_URL + e.path)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      e.imageUrl
        ? [
            "    <image:image>",
            `      <image:loc>${escapeXml(e.imageUrl)}</image:loc>`,
            e.imageTitle ? `      <image:title>${escapeXml(e.imageTitle)}</image:title>` : null,
            "    </image:image>",
          ]
            .filter(Boolean)
            .join("\n")
        : null,
      "  </url>",
    ]
      .filter(Boolean)
      .join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    ns,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

(async () => {
  const pubs = await fetchPublications();

  const dynamic: SitemapEntry[] = pubs.map((p) => {
    const seg = categorySegment(p.category);
    const slug = `${slugify(p.title)}-${idSuffix(p.id)}`;
    return {
      path: `/${seg}/${slug}`,
      lastmod: p.updated_at ? new Date(p.updated_at).toISOString().slice(0, 10) : undefined,
      changefreq: "monthly",
      priority: "0.8",
      imageUrl: p.cover_image_url || undefined,
      imageTitle: p.title,
    };
  });

  // Unique author pages
  const authorMap = new Map<string, string>();
  for (const p of pubs) {
    const s = slugify(p.author || "");
    if (s && !authorMap.has(s)) authorMap.set(s, p.author);
  }
  const authors: SitemapEntry[] = Array.from(authorMap.keys()).map((s) => ({
    path: `/auteur/${s}`,
    changefreq: "monthly",
    priority: "0.6",
  }));

  const all = [...staticEntries, ...dynamic, ...authors];
  writeFileSync(resolve("public/sitemap.xml"), buildSitemap(all));
  console.log(
    `sitemap.xml written (${all.length} entries: ${staticEntries.length} static, ${dynamic.length} publications, ${authors.length} authors)`,
  );
})();

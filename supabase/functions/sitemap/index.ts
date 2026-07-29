// Dynamic sitemap.xml — generated on each request from the publications table.
// No redeploy needed when a new book is published.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BASE_URL = "https://www.kmgbibliotheque.com";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "https://vlqjdszawxtwutuzvskt.supabase.co";
const SUPABASE_ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

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

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: string;
  priority?: string;
  imageUrl?: string;
  imageTitle?: string;
}

const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/bibliotheque", changefreq: "daily", priority: "0.9" },
  { path: "/bibliotheque?categorie=livre", changefreq: "weekly", priority: "0.8" },
  { path: "/bibliotheque?categorie=memoire", changefreq: "weekly", priority: "0.8" },
  { path: "/bibliotheque?categorie=tfc", changefreq: "weekly", priority: "0.8" },
  { path: "/bibliotheque?categorie=article", changefreq: "weekly", priority: "0.8" },
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
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/publications?select=id,title,author,category,cover_image_url,updated_at&is_published=eq.true`,
    { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
  );
  if (!res.ok) return [];
  return await res.json();
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
          ].filter(Boolean).join("\n")
        : null,
      "  </url>",
    ].filter(Boolean).join("\n"),
  );
  return [`<?xml version="1.0" encoding="UTF-8"?>`, ns, ...urls, `</urlset>`].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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

    const xml = buildSitemap([...staticEntries, ...dynamic, ...authors]);
    return new Response(xml, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  } catch (err) {
    console.error("sitemap error:", err);
    return new Response(`<!-- sitemap temporarily unavailable -->`, {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/xml" },
    });
  }
});

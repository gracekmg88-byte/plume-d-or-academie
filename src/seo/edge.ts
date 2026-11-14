// Rendu à la demande des pages référencées — exécuté par les Cloudflare Pages Functions
// (dossier functions/ à la racine du dépôt). Code Worker : fetch, caches, crypto.subtle.
//
// Pourquoi : les pages prérendues au build ne connaissent que les publications existant au
// moment du dernier `git push`. Ici, chaque fiche (et le sitemap) est construite à partir des
// données actuelles de Supabase : une publication ajoutée dans l'admin est aussitôt visible
// pour Google, avec ses balises, son JSON-LD et sa place dans le sitemap.
//
// Sécurité de fonctionnement : en cas de souci (Supabase injoignable, variables absentes…),
// on rend la main à Cloudflare (`next()`), qui sert la page prérendue ou l'application.
import { parseSlugSuffix, slugify } from "../lib/slug";
import {
  PUBLICATION_SEO_COLUMNS,
  authorSeo,
  buildSitemapXml,
  notFoundSeo,
  publicationSeo,
  renderSeoHtml,
  type SeoPublication,
} from "./pageSeo";

export interface EdgeEnv {
  ASSETS: { fetch: (req: Request | string) => Promise<Response> };
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
export interface EdgeContext {
  request: Request;
  env: EdgeEnv;
  params: Record<string, string | string[]>;
  next: () => Promise<Response>;
  waitUntil: (p: Promise<unknown>) => void;
}

const PAGE_TTL = 600; // 10 min : délai maximal pour voir une modification de titre/couverture
const SITEMAP_TTL = 3600; // 1 h
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class UpstreamError extends Error {}

function supabase(env: EdgeEnv) {
  const url = (env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const key = env.VITE_SUPABASE_PUBLISHABLE_KEY || "";
  if (!url || !key) return null;
  return async <T>(table: string, query: string): Promise<T[]> => {
    const r = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    if (!r.ok) throw new UpstreamError(`Supabase ${table} ${r.status}`);
    return (await r.json()) as T[];
  };
}
type Sb = NonNullable<ReturnType<typeof supabase>>;

async function shortHash(s: string) {
  const d = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s));
  return [...new Uint8Array(d).slice(0, 6)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Gabarit index.html de la version actuellement en ligne (même déploiement que les fichiers JS). */
async function template(ctx: EdgeContext): Promise<string> {
  const r = await ctx.env.ASSETS.fetch(new URL("/", ctx.request.url).toString());
  if (!r.ok) throw new UpstreamError(`gabarit ${r.status}`);
  return await r.text();
}

function htmlResponse(html: string, status: number) {
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Le navigateur revalide toujours (le gabarit change à chaque mise en ligne) ;
      // la mise en cache se fait côté Cloudflare via la Cache API ci-dessous.
      "Cache-Control": "no-cache",
      "X-KMG-Render": "edge",
    },
  });
}

/** Sert depuis le cache Cloudflare, sinon fabrique la réponse et la met en cache `ttl` secondes. */
async function cached(ctx: EdgeContext, key: string, ttl: number, make: () => Promise<Response>) {
  const cache = (caches as unknown as { default: Cache }).default;
  const req = new Request(key);
  const hit = await cache.match(req);
  if (hit) {
    const h = new Response(ctx.request.method === "HEAD" ? null : hit.body, hit);
    h.headers.set("Cache-Control", "no-cache");
    h.headers.set("X-KMG-Cache", "HIT");
    return h;
  }
  const res = await make();
  if (res.status === 200 || res.status === 404) {
    const copy = res.clone();
    const stored = new Response(copy.body, copy);
    stored.headers.set("Cache-Control", `public, max-age=${ttl}`);
    ctx.waitUntil(cache.put(req, stored));
  }
  // HEAD : mêmes en-têtes, sans corps (la version mise en cache garde, elle, le corps complet).
  return ctx.request.method === "HEAD" ? new Response(null, res) : res;
}

async function findPublication(sb: Sb, segment: string, raw: string): Promise<SeoPublication | null> {
  const base = `select=${PUBLICATION_SEO_COLUMNS}&is_published=eq.true&limit=1`;
  if (segment === "publication") {
    if (UUID_RE.test(raw)) {
      return (await sb<SeoPublication>("publications", `${base}&id=eq.${raw}`))[0] ?? null;
    }
    const code = raw.toUpperCase();
    if (!/^[A-Z0-9-]{3,40}$/.test(code)) return null;
    const direct = await sb<SeoPublication>("publications", `${base}&publication_number=eq.${encodeURIComponent(code)}`);
    if (direct[0]) return direct[0];
    // QR des certificats : le numéro peut n'exister que dans la table certificates.
    const cert = await sb<{ publication_id: string }>(
      "certificates",
      `select=publication_id&or=(publication_number.eq.${code},certificate_number.eq.${code})&limit=1`,
    );
    if (!cert[0]) return null;
    return (await sb<SeoPublication>("publications", `${base}&id=eq.${cert[0].publication_id}`))[0] ?? null;
  }
  const suffix = parseSlugSuffix(raw);
  if (!suffix) return null;
  const lo = `${suffix.slice(0, 6)}00-0000-0000-0000-000000000000`;
  const hi = `${suffix.slice(0, 6)}ff-ffff-ffff-ffff-ffffffffffff`;
  return (await sb<SeoPublication>("publications", `${base}&id=gte.${lo}&id=lte.${hi}`))[0] ?? null;
}

/** « / » final → même adresse sans « / » (une seule URL par page). */
function stripTrailingSlash(url: URL): Response | null {
  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    return new Response(null, {
      status: 301,
      headers: { Location: url.pathname.replace(/\/+$/, "") + url.search, "Cache-Control": "no-cache" },
    });
  }
  return null;
}

function param(ctx: EdgeContext, name: string) {
  const v = ctx.params[name];
  return decodeURIComponent(Array.isArray(v) ? v.join("/") : v || "");
}

// ─── Fiche publication : /livre|memoire|tfc|article/<slug>  et  /publication/<numéro|uuid> ───
export async function onPublicationRequest(ctx: EdgeContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== "GET" && request.method !== "HEAD") return ctx.next();
  const sb = supabase(ctx.env);
  if (!sb) return ctx.next();
  const url = new URL(request.url);
  const slashRedirect = stripTrailingSlash(url);
  if (slashRedirect) return slashRedirect;
  const segment = url.pathname.split("/")[1];
  const raw = param(ctx, "slug") || param(ctx, "id");

  try {
    const tpl = await template(ctx);
    const v = await shortHash(tpl);
    return await cached(ctx, `https://kmg-seo.cache/${v}${url.pathname.replace(/\/+$/, "")}`, PAGE_TTL, async () => {
      const pub = await findPublication(sb, segment, raw);
      if (!pub) return htmlResponse(renderSeoHtml(tpl, notFoundSeo(url.pathname)), 404);
      const page = publicationSeo(pub);
      // Ancienne adresse (titre modifié, « / » final, mauvaise catégorie) → adresse canonique.
      if (segment !== "publication" && url.pathname !== page.path) {
        return new Response(null, { status: 301, headers: { Location: page.path + url.search, "Cache-Control": "no-cache" } });
      }
      return htmlResponse(renderSeoHtml(tpl, page), 200);
    });
  } catch (e) {
    console.error("[seo] publication", e);
    return ctx.next();
  }
}

// ─── Page auteur : /auteur/<slug> ───────────────────────────────────────────
export async function onAuthorRequest(ctx: EdgeContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== "GET" && request.method !== "HEAD") return ctx.next();
  const sb = supabase(ctx.env);
  if (!sb) return ctx.next();
  const url = new URL(request.url);
  const slashRedirect = stripTrailingSlash(url);
  if (slashRedirect) return slashRedirect;
  const slug = param(ctx, "slug");

  try {
    const tpl = await template(ctx);
    const v = await shortHash(tpl);
    return await cached(ctx, `https://kmg-seo.cache/${v}/auteur/${slug}`, PAGE_TTL, async () => {
      // Pas de table auteurs : on retrouve l'auteur par son slug parmi les publications publiées.
      const pubs = await sb<SeoPublication>(
        "publications",
        `select=${PUBLICATION_SEO_COLUMNS}&is_published=eq.true&order=created_at.desc&limit=5000`,
      );
      const mine = pubs.filter((p) => p.author && slugify(p.author.replace(/\s+/g, " ").trim()) === slug);
      if (!mine.length) return htmlResponse(renderSeoHtml(tpl, notFoundSeo(url.pathname)), 404);
      const page = authorSeo(mine[0].author!.replace(/\s+/g, " ").trim(), mine);
      if (url.pathname !== page.path) {
        return new Response(null, { status: 301, headers: { Location: page.path + url.search, "Cache-Control": "no-cache" } });
      }
      return htmlResponse(renderSeoHtml(tpl, page), 200);
    });
  } catch (e) {
    console.error("[seo] auteur", e);
    return ctx.next();
  }
}

// ─── Sitemap toujours à jour : /sitemap.xml ─────────────────────────────────
export async function onSitemapRequest(ctx: EdgeContext): Promise<Response> {
  const { request } = ctx;
  if (request.method !== "GET" && request.method !== "HEAD") return ctx.next();
  const sb = supabase(ctx.env);
  if (!sb) return ctx.next();
  try {
    return await cached(ctx, "https://kmg-seo.cache/sitemap.xml", SITEMAP_TTL, async () => {
      const pubs = await sb<SeoPublication>(
        "publications",
        `select=${PUBLICATION_SEO_COLUMNS}&is_published=eq.true&order=created_at.desc&limit=45000`,
      );
      if (!pubs.length) throw new UpstreamError("aucune publication");
      const { xml } = buildSitemapXml(pubs);
      return new Response(xml, {
        status: 200,
        headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-cache", "X-KMG-Render": "edge" },
      });
    });
  } catch (e) {
    console.error("[seo] sitemap", e);
    return ctx.next();
  }
}

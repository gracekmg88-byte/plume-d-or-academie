// Référencement des fiches publication et des pages auteur — module commun.
//
// Utilisé à trois endroits, pour que Google voie partout exactement la même chose :
//   • scripts/prerender.ts       → pages HTML statiques générées à chaque build ;
//   • functions/ (Cloudflare)    → rendu à la demande (nouvelles publications, sitemap à jour) ;
//   • src/pages/Publication.tsx  → balises posées par l'application React.
//
// Code pur (ni Node, ni React, ni DOM) : il tourne dans Node, dans un Worker Cloudflare et dans
// le navigateur. Aucune information n'est inventée : tout vient de la table `publications`.
import { buildAuthorPath, buildPublicationPath, slugify } from "../lib/slug";
import { billingConfig } from "../config/billing";

export const SITE_URL = "https://www.kmgbibliotheque.com";
export const SITE_NAME = "KMG Bibliothèque";
export const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

/** Colonnes lues pour le référencement (requête publique, publications publiées uniquement). */
export const PUBLICATION_SEO_COLUMNS =
  "id,title,author,description,summary,category,cover_image_url,publication_number,created_at,updated_at,access_level";

export interface SeoPublication {
  id: string;
  title: string;
  author: string | null;
  description: string | null;
  summary?: string | null;
  category: string;
  cover_image_url: string | null;
  publication_number?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  /** free (défaut) ou premium (réservé aux abonnés). */
  access_level?: string | null;
}

/** Profil d'auteur (table `authors`), facultatif : biographie et photo saisies dans l'admin. */
export interface SeoAuthorProfile {
  slug: string;
  name?: string | null;
  biography: string | null;
  photo_url: string | null;
}
export const AUTHOR_PROFILE_COLUMNS = "slug,name,biography,photo_url,updated_at";

export interface SeoPage {
  path: string;
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  ogType: "book" | "article" | "profile" | "website";
  extraMeta: Array<{ property: string; content: string }>;
  jsonLd: Record<string, unknown>[];
  /** Contenu HTML lisible sans JavaScript (placé dans #root, remplacé par React au démarrage). */
  bodyHtml: string;
  noindex?: boolean;
}

// ─── Petits utilitaires ─────────────────────────────────────────────────────
export function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
export function clean(s: string | null | undefined): string {
  return (s || "").replace(/\s+/g, " ").trim();
}
/** Coupe proprement à `n` caractères, sur un espace, avec « … ». */
export function clamp(s: string, n: number): string {
  const c = clean(s);
  if (c.length <= n) return c;
  const cut = c.slice(0, n - 1);
  const sp = cut.lastIndexOf(" ");
  return `${(sp > n * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.–—-]+$/, "")}…`;
}
/** Retire les valeurs undefined/vides (JSON-LD propre). */
function compact<T extends Record<string, unknown>>(o: T): T {
  return JSON.parse(JSON.stringify(o, (_k, v) => (v === "" || v === null ? undefined : v)));
}

export function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    livre: "Livre",
    memoire: "Mémoire",
    tfc: "Travail de fin de cycle",
    article: "Article scientifique",
  };
  return map[category] || "Publication";
}
function schemaType(category: string): string {
  if (category === "livre") return "Book";
  if (category === "article") return "ScholarlyArticle";
  if (category === "memoire" || category === "tfc") return "Thesis";
  return "CreativeWork";
}
/** Lecture intégrale gratuite tant que la facturation est désactivée (src/config/billing.ts). */
export function isFreeToRead(): boolean {
  return !billingConfig.billingEnabled;
}
function isbnOf(p: SeoPublication): string | undefined {
  return (p.description || "").match(/ISBN[:\s]*([0-9Xx-]{10,17})/)?.[1];
}
function absoluteUrl(path: string) {
  return `${SITE_URL}${path}`;
}
const PROVIDER = { "@type": "Organization", name: SITE_NAME, url: SITE_URL };

// ─── Fiche publication ──────────────────────────────────────────────────────
export function coverAlt(p: Pick<SeoPublication, "title" | "author">): string {
  return p.author ? `Couverture de « ${clean(p.title)} » de ${clean(p.author)}` : `Couverture de « ${clean(p.title)} »`;
}

export function publicationSeo(p: SeoPublication): SeoPage {
  const path = buildPublicationPath({ id: p.id, title: p.title, category: p.category });
  const url = absoluteUrl(path);
  const label = categoryLabel(p.category);
  const title = clean(p.title);
  const author = clean(p.author);
  const desc = clean(p.description) || clean(p.summary);
  // Livre réservé aux abonnés : jamais annoncé comme gratuit.
  const free = isFreeToRead() && p.access_level !== "premium";

  // Titre unique : « Titre | Auteur | KMG Bibliothèque »
  // (si l'auteur est KMG Bibliothèque elle-même, la catégorie évite de répéter le nom du site)
  const titleAuthor = author && slugify(author) !== slugify(SITE_NAME) ? author : label;
  const pageTitle = `${title} | ${titleAuthor} | ${SITE_NAME}`;
  // Description unique : nature + auteur, puis le début de la présentation réelle de l'ouvrage.
  const lead = author ? `${label} de ${author}` : label;
  const description = desc
    ? clamp(`${lead}. ${desc}`, 160)
    : clamp(`Découvrez « ${title} »${author ? ` de ${author}` : ""} sur ${SITE_NAME} : présentation et informations sur cet ouvrage.`, 160);

  const type = schemaType(p.category);
  const authorPath = author ? buildAuthorPath(author) : null;
  const image = p.cover_image_url || DEFAULT_IMAGE;

  const work = compact({
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${url}#oeuvre`,
    name: title,
    headline: type === "ScholarlyArticle" ? title : undefined,
    author: author ? { "@type": "Person", name: author, url: absoluteUrl(authorPath!) } : undefined,
    description: desc ? clamp(desc, 5000) : undefined,
    image: p.cover_image_url || undefined,
    url,
    genre: label,
    bookFormat: type === "Book" ? "https://schema.org/EBook" : undefined,
    isbn: type === "Book" ? isbnOf(p) : undefined,
    identifier: p.publication_number || undefined,
    isAccessibleForFree: free ? true : undefined,
    provider: PROVIDER,
    mainEntityOfPage: url,
  });

  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Bibliothèque", item: `${SITE_URL}/bibliotheque` },
      { "@type": "ListItem", position: 3, name: label, item: `${SITE_URL}/bibliotheque?category=${p.category}` },
      { "@type": "ListItem", position: 4, name: title, item: url },
    ],
  };

  const paragraphs = (p.description || "")
    .split(/\n{2,}|\r\n\r\n/)
    .map(clean)
    .filter(Boolean)
    .slice(0, 12);
  const summary = clean(p.summary);

  const bodyHtml = [
    `<main class="seo-prerender">`,
    `<nav aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/bibliotheque">Bibliothèque</a> › <a href="/bibliotheque?category=${esc(p.category)}">${esc(label)}</a> › <span>${esc(title)}</span></nav>`,
    `<article>`,
    `<h1>${esc(title)}</h1>`,
    author ? `<p>${esc(label)} de <a href="${esc(authorPath!)}">${esc(author)}</a></p>` : `<p>${esc(label)}</p>`,
    p.cover_image_url
      ? `<img src="${esc(p.cover_image_url)}" alt="${esc(coverAlt(p))}" width="400" height="600" />`
      : "",
    `<dl>`,
    author ? `<dt>Auteur</dt><dd><a href="${esc(authorPath!)}">${esc(author)}</a></dd>` : "",
    `<dt>Catégorie</dt><dd>${esc(label)}</dd>`,
    p.publication_number ? `<dt>Référence KMG</dt><dd>${esc(p.publication_number)}</dd>` : "",
    isbnOf(p) ? `<dt>ISBN</dt><dd>${esc(isbnOf(p)!)}</dd>` : "",
    `</dl>`,
    paragraphs.length ? `<h2>Présentation</h2>${paragraphs.map((t) => `<p>${esc(t)}</p>`).join("")}` : "",
    summary && summary !== clean(p.description) ? `<h2>Résumé</h2><p>${esc(summary)}</p>` : "",
    `<p><a href="${esc(path)}">${free ? "Lire" : "Consulter"} « ${esc(title)} » sur ${SITE_NAME}</a></p>`,
    author ? `<p><a href="${esc(authorPath!)}">Toutes les publications de ${esc(author)}</a></p>` : "",
    `</article>`,
    `</main>`,
  ].filter(Boolean).join("");

  const extraMeta: SeoPage["extraMeta"] = [];
  if (p.category === "livre" && author) extraMeta.push({ property: "book:author", content: absoluteUrl(authorPath!) });
  if (p.category === "livre" && isbnOf(p)) extraMeta.push({ property: "book:isbn", content: isbnOf(p)! });

  return {
    path,
    title: pageTitle,
    description,
    image,
    imageAlt: coverAlt(p),
    ogType: p.category === "livre" ? "book" : "article",
    extraMeta,
    jsonLd: [work, breadcrumb],
    bodyHtml,
  };
}

// ─── Page auteur ────────────────────────────────────────────────────────────
/** Regroupe les publications par auteur (clé = slug, comme l'URL /auteur/<slug>). */
export function groupByAuthor(pubs: SeoPublication[]): Map<string, { name: string; pubs: SeoPublication[] }> {
  const map = new Map<string, { name: string; pubs: SeoPublication[] }>();
  for (const p of pubs) {
    const name = clean(p.author);
    if (!name) continue;
    const s = slugify(name);
    if (!map.has(s)) map.set(s, { name, pubs: [] });
    map.get(s)!.pubs.push(p);
  }
  return map;
}

export function authorSeo(name: string, pubs: SeoPublication[], profile?: SeoAuthorProfile | null): SeoPage {
  const path = buildAuthorPath(name);
  const url = absoluteUrl(path);
  const n = pubs.length;
  const titles = pubs.map((p) => `« ${clean(p.title)} »`);
  const bio = clean(profile?.biography);
  const photo = profile?.photo_url || null;
  // Pas de « Nom : Nom… » quand le début de la biographie nomme déjà l'auteur.
  const bioHead = slugify(bio.slice(0, 60)).split("-");
  const bioNamesAuthor = slugify(name).split("-").some((w) => w.length >= 3 && bioHead.includes(w));
  const description = bio
    ? clamp(bioNamesAuthor ? bio : `${name} : ${bio}`, 160)
    : clamp(`${name} sur ${SITE_NAME} : ${n} publication${n > 1 ? "s" : ""} — ${titles.join(", ")}.`, 160);
  const first = pubs.find((p) => p.cover_image_url);
  const bioParagraphs = (profile?.biography || "").split(/\r?\n\s*\r?\n/).map(clean).filter(Boolean);

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "ProfilePage",
      url,
      name: `${name} — ${SITE_NAME}`,
      mainEntity: compact({
        "@type": "Person",
        "@id": `${url}#auteur`,
        name,
        url,
        description: bio ? clamp(bio, 5000) : undefined,
        image: photo || undefined,
      }),
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: `Publications de ${name}`,
      numberOfItems: n,
      itemListElement: pubs.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(buildPublicationPath(p)),
        name: clean(p.title),
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Bibliothèque", item: `${SITE_URL}/bibliotheque` },
        { "@type": "ListItem", position: 3, name, item: url },
      ],
    },
  ];

  const bodyHtml = [
    `<main class="seo-prerender">`,
    `<nav aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/bibliotheque">Bibliothèque</a> › <span>${esc(name)}</span></nav>`,
    `<h1>${esc(name)}</h1>`,
    photo ? `<img src="${esc(photo)}" alt="${esc(`Photo de ${name}`)}" width="240" height="240" />` : "",
    bioParagraphs.length ? `<h2>Biographie</h2>${bioParagraphs.map((t) => `<p>${esc(t)}</p>`).join("")}` : "",
    `<h2>Publications</h2>`,
    `<p>${n} publication${n > 1 ? "s" : ""} de ${esc(name)} sur ${SITE_NAME}.</p>`,
    `<ul>`,
    ...pubs.map((p) => {
      const href = buildPublicationPath(p);
      return `<li><a href="${esc(href)}">${
        p.cover_image_url ? `<img src="${esc(p.cover_image_url)}" alt="${esc(coverAlt(p))}" width="160" height="240" loading="lazy" />` : ""
      }<span>${esc(clean(p.title))}</span></a> — ${esc(categoryLabel(p.category))}</li>`;
    }),
    `</ul>`,
    `</main>`,
  ].filter(Boolean).join("");

  return {
    path,
    title: `${name} | Auteur | ${SITE_NAME}`,
    description,
    image: photo || first?.cover_image_url || DEFAULT_IMAGE,
    imageAlt: photo ? `Photo de ${name}` : first ? coverAlt(first) : SITE_NAME,
    ogType: "profile",
    extraMeta: [],
    jsonLd,
    bodyHtml,
  };
}

/** Page « introuvable » (réponse 404, non indexée). */
export function notFoundSeo(path: string): SeoPage {
  return {
    path,
    title: `Page introuvable | ${SITE_NAME}`,
    description: "Cette page n'existe pas ou n'est plus disponible sur KMG Bibliothèque.",
    image: DEFAULT_IMAGE,
    imageAlt: SITE_NAME,
    ogType: "website",
    extraMeta: [],
    jsonLd: [],
    bodyHtml: `<main class="seo-prerender"><h1>Page introuvable</h1><p><a href="/bibliotheque">Retour à la bibliothèque</a></p></main>`,
    noindex: true,
  };
}

// ─── Injection dans le gabarit index.html ───────────────────────────────────
/** Remplace les balises génériques du gabarit par celles de la page et place le contenu dans #root. */
export function renderSeoHtml(template: string, page: SeoPage): string {
  const url = absoluteUrl(page.path);
  let html = template
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="(description|keywords|robots)"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:[^"]*"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:[^"]*"[^>]*>/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");

  const head = [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}" />`,
    page.noindex ? `<meta name="robots" content="noindex" />` : `<meta name="robots" content="index, follow, max-image-preview:large" />`,
    page.noindex ? "" : `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta property="og:type" content="${page.ogType}" />`,
    `<meta property="og:title" content="${esc(page.title)}" />`,
    `<meta property="og:description" content="${esc(page.description)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:image" content="${esc(page.image)}" />`,
    `<meta property="og:image:alt" content="${esc(page.imageAlt)}" />`,
    ...page.extraMeta.map((m) => `<meta property="${esc(m.property)}" content="${esc(m.content)}" />`),
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(page.title)}" />`,
    `<meta name="twitter:description" content="${esc(page.description)}" />`,
    `<meta name="twitter:image" content="${esc(page.image)}" />`,
    `<meta name="twitter:image:alt" content="${esc(page.imageAlt)}" />`,
    ...page.jsonLd.map((ld) => `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`),
  ]
    .filter(Boolean)
    // Marquées data-kmg-seo : l'application React les retire quand elle pose ses propres balises
    // (src/components/seo/SEO.tsx), pour éviter les doublons une fois la page affichée.
    .map((tag) => (tag.startsWith("<title>") ? tag : tag.replace(/^<(meta|link|script)\b/, "<$1 data-kmg-seo")))
    .join("\n    ");

  html = html.replace("</head>", `    ${head}\n  </head>`);
  // Le contenu est dans #root : lisible immédiatement par les robots ; l'écran de démarrage le
  // recouvre pour les visiteurs, puis React le remplace en montant l'application.
  html = html.replace(/<div id="root">[\s\S]*?<\/div>(?=\s*(<script|<\/body>|<noscript))/i, `<div id="root">${page.bodyHtml}</div>`);
  return html;
}

// ─── Sitemap ────────────────────────────────────────────────────────────────
export const STATIC_SITEMAP_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/bibliotheque", changefreq: "daily", priority: "0.9" },
  { path: "/a-propos", changefreq: "monthly", priority: "0.6" },
  { path: "/contact", changefreq: "monthly", priority: "0.5" },
  { path: "/depot-memoire", changefreq: "monthly", priority: "0.6" },
  { path: "/verification", changefreq: "monthly", priority: "0.4" },
];

function xml(s: string) {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}
function day(d?: string | null) {
  if (!d) return undefined;
  const t = new Date(d);
  return Number.isNaN(t.getTime()) ? undefined : t.toISOString().slice(0, 10);
}

export function buildSitemapXml(
  pubs: SeoPublication[],
  profiles: Array<SeoAuthorProfile & { updated_at?: string | null }> = [],
): { xml: string; counts: { static: number; publications: number; authors: number } } {
  type E = { loc: string; lastmod?: string; changefreq?: string; priority?: string; image?: { loc: string; title: string } };
  const entries: E[] = STATIC_SITEMAP_PAGES.map((s) => ({ loc: absoluteUrl(s.path), changefreq: s.changefreq, priority: s.priority }));
  for (const p of pubs) {
    entries.push({
      loc: absoluteUrl(buildPublicationPath(p)),
      lastmod: day(p.updated_at || p.created_at),
      changefreq: "monthly",
      priority: "0.8",
      image: p.cover_image_url ? { loc: p.cover_image_url, title: coverAlt(p) } : undefined,
    });
  }
  const authors = groupByAuthor(pubs);
  const bySlug = new Map(profiles.map((p) => [p.slug, p]));
  for (const [slug, { name, pubs: list }] of authors.entries()) {
    const prof = bySlug.get(slug);
    const last = [...list.map((p) => p.updated_at || p.created_at || ""), prof?.updated_at || ""].sort().pop();
    entries.push({
      loc: absoluteUrl(buildAuthorPath(name)),
      lastmod: day(last),
      changefreq: "monthly",
      priority: "0.6",
      image: prof?.photo_url ? { loc: prof.photo_url, title: `Photo de ${name}` } : undefined,
    });
  }
  const body = entries.map((e) =>
    [
      "  <url>",
      `    <loc>${xml(e.loc)}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : "",
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : "",
      e.priority ? `    <priority>${e.priority}</priority>` : "",
      e.image ? `    <image:image>\n      <image:loc>${xml(e.image.loc)}</image:loc>\n      <image:title>${xml(e.image.title)}</image:title>\n    </image:image>` : "",
      "  </url>",
    ].filter(Boolean).join("\n"),
  ).join("\n");
  return {
    xml: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${body}\n</urlset>\n`,
    counts: { static: STATIC_SITEMAP_PAGES.length, publications: pubs.length, authors: authors.size },
  };
}

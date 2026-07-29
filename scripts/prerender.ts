// Prerender: génère un fichier HTML statique par publication et par auteur
// après `vite build` (hook postbuild). Chaque fichier contient le <head>
// complet (title, description, canonical, OG, Twitter, JSON-LD) et un
// contenu HTML lisible immédiatement par Google, avant même l'exécution
// du JavaScript. React réhydrate ensuite normalement dans #root.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

const BASE_URL = "https://www.kmgbibliotheque.com";
const SUPABASE_URL = "https://vlqjdszawxtwutuzvskt.supabase.co";
const SUPABASE_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZscWpkc3phd3h0d3V0dXp2c2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg1MDM4NjksImV4cCI6MjA4NDA3OTg2OX0.zbFWoYJbXZgdM9lfpOV3-YxZayClpw_Vp8i-cFC_77A";

// Garde-fou : ne jamais dépasser les limites de publication de la plateforme.
const MAX_PRERENDER_PAGES = Number(process.env.MAX_PRERENDER_PAGES || 5000);

const DIST = resolve("dist");
const TEMPLATE_PATH = resolve(DIST, "index.html");

// --- helpers (alignés sur src/lib/slug.ts) ---
function slugify(input: string): string {
  return (
    (input || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/['’`"]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "publication"
  );
}
function idSuffix(id: string): string {
  return (id || "").replace(/-/g, "").slice(0, 6).toLowerCase();
}
function categorySegment(category: string): string {
  const map: Record<string, string> = {
    livre: "livre",
    memoire: "memoire",
    tfc: "tfc",
    article: "article",
  };
  return map[category] || "publication";
}
function categoryLabel(category: string): string {
  const map: Record<string, string> = {
    livre: "Livre",
    memoire: "Mémoire",
    tfc: "TFC",
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
function esc(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
function clamp(s: string, n: number): string {
  const clean = (s || "").replace(/\s+/g, " ").trim();
  return clean.length > n ? `${clean.slice(0, n - 3)}...` : clean;
}

interface PubRow {
  id: string;
  title: string;
  author: string;
  description: string | null;
  summary: string | null;
  category: string;
  cover_image_url: string | null;
  publication_number: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

async function fetchPublications(): Promise<PubRow[]> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/publications?select=id,title,author,description,summary,category,cover_image_url,publication_number,created_at,updated_at&is_published=eq.true`,
      { headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${SUPABASE_ANON}` } },
    );
    if (!res.ok) {
      console.warn(`[prerender] fetch failed: ${res.status}`);
      return [];
    }
    return await res.json();
  } catch (err) {
    console.warn("[prerender] fetch error", err);
    return [];
  }
}

/** Remplace/injecte les balises head du template par celles de la page. */
function buildHtml(
  template: string,
  opts: {
    path: string;
    title: string;
    description: string;
    image?: string | null;
    ogType: string;
    keywords?: string[];
    jsonLd: Record<string, unknown>[];
    body: string;
  },
): string {
  const url = `${BASE_URL}${opts.path}`;
  const desc = clamp(opts.description, 160);
  const image = opts.image || `${BASE_URL}/og-image.png`;

  let html = template;

  // Retire les balises head génériques du template pour éviter les doublons.
  html = html
    .replace(/<title>[\s\S]*?<\/title>/i, "")
    .replace(/<meta\s+name="description"[^>]*>/gi, "")
    .replace(/<meta\s+name="keywords"[^>]*>/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>/gi, "")
    .replace(/<meta\s+property="og:(title|description|url|image|type)"[^>]*>/gi, "")
    .replace(/<meta\s+name="twitter:(title|description|image)"[^>]*>/gi, "")
    .replace(/<script type="application\/ld\+json">[\s\S]*?<\/script>/gi, "");

  const head = [
    `<title>${esc(opts.title)}</title>`,
    `<meta name="description" content="${esc(desc)}" />`,
    opts.keywords?.length
      ? `<meta name="keywords" content="${esc(opts.keywords.join(", "))}" />`
      : "",
    `<link rel="canonical" href="${esc(url)}" />`,
    `<meta property="og:title" content="${esc(opts.title)}" />`,
    `<meta property="og:description" content="${esc(desc)}" />`,
    `<meta property="og:url" content="${esc(url)}" />`,
    `<meta property="og:type" content="${opts.ogType}" />`,
    `<meta property="og:image" content="${esc(image)}" />`,
    `<meta property="og:site_name" content="KMG Bibliothèque" />`,
    `<meta property="og:locale" content="fr_FR" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${esc(opts.title)}" />`,
    `<meta name="twitter:description" content="${esc(desc)}" />`,
    `<meta name="twitter:image" content="${esc(image)}" />`,
    ...opts.jsonLd.map(
      (ld) =>
        `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, "\\u003c")}</script>`,
    ),
  ]
    .filter(Boolean)
    .join("\n    ");

  html = html.replace("</head>", `  ${head}\n  </head>`);

  // Contenu HTML complet présent dès la première réponse du serveur.
  // Placé dans <noscript> : les robots (Google, Bing, réseaux sociaux, IA)
  // le lisent immédiatement, et aucun utilisateur ne voit de contenu
  // non stylé clignoter avant le montage de React.
  const seoBody = `<noscript>${opts.body}</noscript>`;
  html = html.replace(/<div id="root">[\s\S]*?<\/div>/i, `<div id="root">${seoBody}</div>`);
  if (!html.includes('<div id="root">')) {
    html = html.replace("<body>", `<body><div id="root">${seoBody}</div>`);
  }


  return html;
}

function pubBody(p: PubRow, path: string): string {
  const label = categoryLabel(p.category);
  const desc = p.description || p.summary || "";
  const authorHref = `/auteur/${slugify(p.author || "")}`;
  return [
    `<main>`,
    `<nav aria-label="Fil d'Ariane"><a href="/">Accueil</a> › <a href="/bibliotheque">Bibliothèque</a> › <span>${esc(label)}</span></nav>`,
    `<article>`,
    `<h1>${esc(p.title)}</h1>`,
    p.author ? `<p>Auteur : <a href="${esc(authorHref)}">${esc(p.author)}</a></p>` : "",
    `<p>Catégorie : ${esc(label)}</p>`,
    p.publication_number ? `<p>Référence : ${esc(p.publication_number)}</p>` : "",
    p.created_at
      ? `<p>Publié le <time datetime="${esc(new Date(p.created_at).toISOString().slice(0, 10))}">${esc(new Date(p.created_at).toISOString().slice(0, 10))}</time></p>`
      : "",
    p.cover_image_url
      ? `<img src="${esc(p.cover_image_url)}" alt="Couverture de &quot;${esc(p.title)}&quot;${p.author ? ` par ${esc(p.author)}` : ""}" width="400" height="560" />`
      : "",
    desc ? `<p>${esc(clamp(desc, 1200))}</p>` : "",
    p.summary && p.summary !== desc ? `<p>${esc(clamp(p.summary, 1200))}</p>` : "",
    `<p><a href="${esc(path)}">Lire ${esc(p.title)} en ligne gratuitement sur KMG Bibliothèque</a></p>`,
    `</article>`,
    `</main>`,
  ]
    .filter(Boolean)
    .join("");
}

function authorBody(name: string, pubs: PubRow[]): string {
  return [
    `<main>`,
    `<h1>${esc(name)}</h1>`,
    `<p>Publications de ${esc(name)} disponibles sur KMG Bibliothèque.</p>`,
    `<ul>`,
    ...pubs.map(
      (p) =>
        `<li><a href="/${categorySegment(p.category)}/${slugify(p.title)}-${idSuffix(p.id)}">${esc(p.title)}</a> — ${esc(categoryLabel(p.category))}</li>`,
    ),
    `</ul>`,
    `</main>`,
  ].join("");
}

function writeHtml(path: string, html: string) {
  const out = resolve(DIST, `.${path}`, "index.html");
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, html);
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
    const path = `/${categorySegment(p.category)}/${slugify(p.title)}-${idSuffix(p.id)}`;
    const label = categoryLabel(p.category);
    const description =
      p.description ||
      p.summary ||
      `${p.title}${p.author ? ` — ${p.author}` : ""} sur KMG Bibliothèque. Lecture en ligne gratuite.`;
    const type = schemaType(p.category);
    const authorUrl = p.author ? `${BASE_URL}/auteur/${slugify(p.author)}` : undefined;
    const isbn = (p.description || "").match(/ISBN[:\s]*([0-9Xx-]{10,17})/)?.[1];

    const jsonLd: Record<string, unknown>[] = [
      JSON.parse(
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": type,
          name: p.title,
          headline: p.title,
          author: p.author ? { "@type": "Person", name: p.author, url: authorUrl } : undefined,
          description: clamp(description, 500),
          abstract: p.summary || undefined,
          image: p.cover_image_url || undefined,
          url: `${BASE_URL}${path}`,
          inLanguage: "fr",
          isAccessibleForFree: true,
          bookFormat: type === "Book" ? "https://schema.org/EBook" : undefined,
          genre: label,
          identifier: p.publication_number || undefined,
          isbn: isbn || undefined,
          datePublished: p.created_at
            ? new Date(p.created_at).toISOString().slice(0, 10)
            : undefined,
          dateModified: p.updated_at
            ? new Date(p.updated_at).toISOString().slice(0, 10)
            : undefined,
          publisher: {
            "@type": "Organization",
            name: "KMG Bibliothèque",
            url: BASE_URL,
          },
        }),
      ),
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Accueil", item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Bibliothèque", item: `${BASE_URL}/bibliotheque` },
          {
            "@type": "ListItem",
            position: 3,
            name: label,
            item: `${BASE_URL}/bibliotheque?category=${p.category}`,
          },
          { "@type": "ListItem", position: 4, name: p.title, item: `${BASE_URL}${path}` },
        ],
      },
    ];

    writeHtml(
      path,
      buildHtml(template, {
        path,
        title: `${p.title}${p.author ? ` — ${p.author}` : ""} | KMG Bibliothèque`,
        description,
        image: p.cover_image_url,
        ogType: p.category === "livre" ? "book" : "article",
        keywords: [p.title, p.author, label, "KMG Bibliothèque", "lecture en ligne"].filter(
          Boolean,
        ) as string[],
        jsonLd,
        body: pubBody(p, path),
      }),
    );
    count++;
  }

  // Pages auteurs
  const byAuthor = new Map<string, { name: string; pubs: PubRow[] }>();
  for (const p of pubs) {
    const s = slugify(p.author || "");
    if (!p.author || !s) continue;
    if (!byAuthor.has(s)) byAuthor.set(s, { name: p.author, pubs: [] });
    byAuthor.get(s)!.pubs.push(p);
  }

  for (const [slug, { name, pubs: list }] of byAuthor) {
    if (count >= MAX_PRERENDER_PAGES) break;
    const path = `/auteur/${slug}`;
    writeHtml(
      path,
      buildHtml(template, {
        path,
        title: `${name} — Publications | KMG Bibliothèque`,
        description: `Découvrez les ${list.length} publication(s) de ${name} sur KMG Bibliothèque : lecture en ligne gratuite.`,
        ogType: "profile",
        keywords: [name, "auteur", "KMG Bibliothèque"],
        jsonLd: [
          {
            "@context": "https://schema.org",
            "@type": "Person",
            name,
            url: `${BASE_URL}${path}`,
          },
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            itemListElement: list.map((p, i) => ({
              "@type": "ListItem",
              position: i + 1,
              name: p.title,
              url: `${BASE_URL}/${categorySegment(p.category)}/${slugify(p.title)}-${idSuffix(p.id)}`,
            })),
          },
        ],
        body: authorBody(name, list),
      }),
    );
    count++;
  }

  console.log(
    `[prerender] ${count} pages HTML générées (${pubs.length} publications, ${byAuthor.size} auteurs).`,
  );
})();

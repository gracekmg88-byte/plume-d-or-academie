// Pages fixes (accueil, bibliothèque, à propos…) servies par le serveur avec leur propre contenu.
//
// Avant : le serveur renvoyait pour toutes ces adresses le même gabarit index.html (sans canonical,
// sans H1, sans texte, og:url = accueil) ; seul le JavaScript posait ensuite les bonnes balises.
// Google pouvait donc les prendre pour des pages vides (soft 404) ou des doublons.
// Les textes reprennent ceux que l'application affiche (src/contexts/LanguageContext.tsx, pages) :
// rien n'est inventé. Code pur : tourne dans un Worker Cloudflare comme dans Node.
import { buildPublicationPath } from "../lib/slug";
import {
  DEFAULT_IMAGE,
  SITE_NAME,
  SITE_URL,
  categoryLabel,
  clean,
  esc,
  type SeoPage,
  type SeoPublication,
} from "./pageSeo";

interface StaticDef {
  title: string;
  description: string;
  h1: string;
  paragraphs: string[];
  /** Publications listées (liens) : "all" = tout le catalogue par catégorie, nombre = les plus récentes. */
  list?: "all" | number;
  schemaType: "WebSite" | "CollectionPage" | "AboutPage" | "ContactPage" | "WebPage";
}

const CATEGORY_ORDER = ["livre", "memoire", "tfc", "article"];
const CATEGORY_PLURAL: Record<string, string> = {
  livre: "Livres",
  memoire: "Mémoires",
  tfc: "Travaux de fin de cycle (TFC)",
  article: "Articles scientifiques",
};

const CONTACT_LINE = "Téléphone : +243 998 102 000 — Email : kmgmultiservices98@gmail.com — Horaires : lundi à samedi, 8 h - 18 h.";

export const STATIC_PAGES: Record<string, StaticDef> = {
  "/": {
    title: "KMG Bibliothèque Numérique — livres, mémoires, TFC et articles",
    description:
      "Livres, mémoires, TFC et articles académiques en ligne et hors-ligne, dont de nombreux documents gratuits. Plateforme francophone éditée par KMG Multi Services.",
    h1: "KMG Bibliothèque Numérique",
    paragraphs: [
      "Votre passerelle vers le savoir. Explorez notre collection de livres, mémoires, TFC et articles académiques.",
      "Une plateforme dédiée à la diffusion du savoir académique et à la valorisation des travaux de recherche. De nombreux contenus académiques sont gratuits ; certains ouvrages sont réservés aux abonnés Premium.",
      "Mémoires, TFC et articles rédigés par des étudiants et chercheurs. Tous les contenus sont vérifiés et validés avant publication.",
    ],
    list: 12,
    schemaType: "WebSite",
  },
  "/bibliotheque": {
    title: "Bibliothèque — livres, mémoires, TFC et articles | KMG Bibliothèque",
    description:
      "Catalogue académique complet : livres, mémoires, TFC et articles scientifiques avec filtres, recherche et tri. Nombreux documents gratuits, lecture en ligne et hors-ligne.",
    h1: "Bibliothèque",
    paragraphs: ["Explorez notre collection de livres, mémoires, TFC et articles académiques."],
    list: "all",
    schemaType: "CollectionPage",
  },
  "/a-propos": {
    title: "À propos — KMG Bibliothèque",
    description:
      "Mission, valeurs et équipe de KMG Bibliothèque, bibliothèque numérique académique francophone éditée par KMG Multi Services en RDC.",
    h1: "À propos de KMG Bibliothèque",
    paragraphs: [
      "Une bibliothèque académique numérique dédiée à la diffusion du savoir et à la valorisation des travaux de recherche, éditée par KMG Multi Services en République démocratique du Congo.",
      "Notre mission : démocratiser l'accès au savoir académique. Tous nos contenus sont vérifiés et validés avant publication.",
    ],
    schemaType: "AboutPage",
  },
  "/contact": {
    title: "Contact — KMG Bibliothèque",
    description:
      "Contactez KMG Bibliothèque : téléphone +243 998 102 000, email kmgmultiservices98@gmail.com. Formulaire de contact en ligne.",
    h1: "Contactez-nous",
    paragraphs: [
      "Une question, une suggestion ou une demande de partenariat ? N'hésitez pas à nous contacter.",
      CONTACT_LINE,
    ],
    schemaType: "ContactPage",
  },
  "/depot-memoire": {
    title: "Déposer un mémoire ou un TFC — KMG Bibliothèque",
    description:
      "Déposez votre mémoire, TFC ou article sur KMG Bibliothèque : formulaire en ligne, vérification avant publication et suivi de vos dépôts.",
    h1: "Déposer un mémoire, un TFC ou un article",
    paragraphs: [
      "Étudiants et chercheurs peuvent proposer leurs travaux à KMG Bibliothèque grâce à un formulaire en ligne : informations personnelles, détails du travail, puis envoi des fichiers.",
      "Chaque dépôt est vérifié avant publication. Un compte gratuit est nécessaire pour déposer et suivre ses travaux.",
    ],
    schemaType: "WebPage",
  },
  "/verification": {
    title: "Vérification de certificat — KMG Bibliothèque",
    description: "Vérifiez l'authenticité d'une publication certifiée par KMG Bibliothèque via son numéro ou QR code.",
    h1: "Vérification de certificat",
    paragraphs: [
      "Vérifiez l'authenticité d'une publication certifiée par KMG Bibliothèque : saisissez le numéro inscrit sur le certificat ou scannez son QR code.",
    ],
    schemaType: "WebPage",
  },
  "/abonnement": {
    title: "Abonnement — KMG Bibliothèque",
    description:
      "Abonnement Premium KMG Bibliothèque : inscription gratuite, de nombreux documents gratuits et des ouvrages réservés aux abonnés Premium.",
    h1: "Abonnement Premium",
    paragraphs: [
      "L'inscription à KMG Bibliothèque est gratuite et donne accès à de nombreux documents gratuits. Certains ouvrages sont réservés aux abonnés Premium.",
    ],
    schemaType: "WebPage",
  },
  "/confidentialite": {
    title: "Confidentialité & sécurité — KMG Bibliothèque",
    description:
      "Page maintenue par KMG Multi Services expliquant comment Plume d'Or KMG protège vos données, vos lectures et vos contenus déposés.",
    h1: "Confidentialité & sécurité",
    paragraphs: [
      "Cette page, maintenue par KMG Multi Services, explique comment KMG Bibliothèque protège vos données, vos lectures et vos contenus déposés.",
    ],
    schemaType: "WebPage",
  },
  "/suppression-compte": {
    title: "Supprimer mon compte — KMG Bibliothèque",
    description:
      "Comment supprimer votre compte KMG Bibliothèque et vos données personnelles, depuis le site ou l'application.",
    h1: "Supprimer mon compte",
    paragraphs: [
      "Vous pouvez demander la suppression de votre compte KMG Bibliothèque et de vos données personnelles depuis votre profil, sur le site ou dans l'application.",
    ],
    schemaType: "WebPage",
  },
};

export function isStaticSeoPath(path: string): boolean {
  return Object.prototype.hasOwnProperty.call(STATIC_PAGES, path);
}

/** La page a-t-elle besoin de la liste des publications ? (évite une requête inutile) */
export function staticPageNeedsPublications(path: string): boolean {
  return !!STATIC_PAGES[path]?.list;
}

function listHtml(pubs: SeoPublication[], grouped: boolean): string {
  const item = (p: SeoPublication) =>
    `<li><a href="${esc(buildPublicationPath(p))}">${esc(clean(p.title))}</a>${
      clean(p.author) ? ` — ${esc(clean(p.author))}` : ""
    }</li>`;
  if (!grouped) return `<h2>Publications récentes</h2><ul>${pubs.map(item).join("")}</ul>`;
  const cats = [...new Set([...CATEGORY_ORDER, ...pubs.map((p) => p.category)])];
  return cats
    .map((c) => {
      const list = pubs.filter((p) => p.category === c);
      if (!list.length) return "";
      const label = CATEGORY_PLURAL[c] || categoryLabel(c);
      return `<h2><a href="/bibliotheque?categorie=${esc(c)}">${esc(label)}</a></h2><ul>${list.map(item).join("")}</ul>`;
    })
    .join("");
}

/** Page fixe connue → SeoPage, sinon null. `pubs` = publications publiées, plus récentes d'abord. */
export function staticPageSeo(path: string, pubs: SeoPublication[] = []): SeoPage | null {
  if (!isStaticSeoPath(path)) return null;
  const def = STATIC_PAGES[path];
  const url = path === "/" ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  const shown = def.list === "all" ? pubs : typeof def.list === "number" ? pubs.slice(0, def.list) : [];

  const nav =
    `<nav aria-label="Navigation principale"><a href="/">Accueil</a> · <a href="/bibliotheque">Bibliothèque</a> · ` +
    CATEGORY_ORDER.map((c) => `<a href="/bibliotheque?categorie=${c}">${esc(CATEGORY_PLURAL[c])}</a>`).join(" · ") +
    ` · <a href="/a-propos">À propos</a> · <a href="/contact">Contact</a></nav>`;

  const bodyHtml = [
    `<main class="seo-prerender">`,
    nav,
    `<h1>${esc(def.h1)}</h1>`,
    ...def.paragraphs.map((t) => `<p>${esc(t)}</p>`),
    shown.length ? listHtml(shown, def.list === "all") : "",
    shown.length && def.list !== "all" ? `<p><a href="/bibliotheque">Voir toute la bibliothèque</a></p>` : "",
    `</main>`,
  ].join("");

  const site = { "@type": "WebSite", name: SITE_NAME, url: SITE_URL };
  const jsonLd: Record<string, unknown>[] = [
    def.schemaType === "WebSite"
      ? {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          inLanguage: "fr",
          publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
        }
      : {
          "@context": "https://schema.org",
          "@type": def.schemaType,
          name: def.title,
          url,
          description: def.description,
          inLanguage: "fr",
          isPartOf: site,
        },
  ];
  if (shown.length) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      numberOfItems: shown.length,
      itemListElement: shown.map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}${buildPublicationPath(p)}`,
        name: clean(p.title),
      })),
    });
  }

  return {
    path,
    title: def.title,
    description: def.description,
    image: DEFAULT_IMAGE,
    imageAlt: SITE_NAME,
    ogType: "website",
    extraMeta: [],
    jsonLd,
    bodyHtml,
  };
}

import { Helmet } from "react-helmet-async";

const SITE_URL = "https://plume-d-or-academie.lovable.app";
const SITE_NAME = "KMG Bibliothèque";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "book" | "profile";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
  keywords?: string[];
  /** Extra OG/meta tags, e.g. book:author, article:published_time */
  extraMeta?: Array<{ property?: string; name?: string; content: string }>;
}

export function SEO({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
  noindex = false,
  keywords,
  extraMeta,
}: SEOProps) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  const desc = description.length > 160 ? `${description.slice(0, 157)}...` : description;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];
  const kw = keywords && keywords.length > 0
    ? Array.from(new Set(keywords.filter(Boolean).map((k) => k.trim()))).join(", ")
    : null;

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      {kw && <meta name="keywords" content={kw} />}
      <link rel="canonical" href={url} />
      {noindex && <meta name="robots" content="noindex, nofollow" />}

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content={SITE_NAME} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={image} />

      {extraMeta?.map((m, i) =>
        m.property ? (
          <meta key={`p-${i}`} property={m.property} content={m.content} />
        ) : m.name ? (
          <meta key={`n-${i}`} name={m.name} content={m.content} />
        ) : null,
      )}

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}

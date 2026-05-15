import { Helmet } from "react-helmet-async";

const SITE_URL = "https://plume-d-or-academie.lovable.app";
const SITE_NAME = "Plume d'Or KMG";
const DEFAULT_IMAGE = `${SITE_URL}/og-image.png`;

interface SEOProps {
  title: string;
  description: string;
  path: string;
  image?: string;
  type?: "website" | "article" | "book";
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
  noindex?: boolean;
}

export function SEO({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = "website",
  jsonLd,
  noindex = false,
}: SEOProps) {
  const url = `${SITE_URL}${path}`;
  const fullTitle = title.includes(SITE_NAME) ? title : `${title} | ${SITE_NAME}`;
  // Trim description to safe range
  const desc = description.length > 160 ? `${description.slice(0, 157)}...` : description;
  const ldArray = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
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

      {ldArray.map((ld, i) => (
        <script key={i} type="application/ld+json">{JSON.stringify(ld)}</script>
      ))}
    </Helmet>
  );
}

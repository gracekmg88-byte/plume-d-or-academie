// SEO-friendly slug helpers for publications and authors.

export function slugify(input: string): string {
  return (input || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`"]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "publication";
}

// 6-char hex suffix from UUID to guarantee uniqueness while staying readable.
export function idSuffix(id: string): string {
  return (id || "").replace(/-/g, "").slice(0, 6).toLowerCase();
}

export function buildPublicationSlug(title: string, id: string): string {
  return `${slugify(title)}-${idSuffix(id)}`;
}

const CATEGORY_PATH: Record<string, string> = {
  livre: "livre",
  memoire: "memoire",
  tfc: "tfc",
  article: "article",
};

export function categoryPath(category: string | null | undefined): string {
  if (!category) return "publication";
  return CATEGORY_PATH[category] || "publication";
}

export function buildPublicationPath(pub: {
  id: string;
  title: string;
  category?: string | null;
}): string {
  const seg = categoryPath(pub.category);
  return `/${seg}/${buildPublicationSlug(pub.title, pub.id)}`;
}

// Extract trailing UUID-prefix (idSuffix) from a slug like "mon-titre-ab12cd".
export function parseSlugSuffix(slug: string | undefined): string | null {
  if (!slug) return null;
  const m = slug.match(/-([a-f0-9]{6})$/i);
  return m ? m[1].toLowerCase() : null;
}

export function slugifyAuthor(name: string): string {
  return slugify(name);
}

export function buildAuthorPath(name: string): string {
  return `/auteur/${slugifyAuthor(name)}`;
}

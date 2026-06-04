import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo/SEO";
import { Breadcrumb } from "@/components/publications/Breadcrumb";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { useAuthorPublications } from "@/hooks/useAuthorPublications";

const SITE_URL = "https://plume-d-or-academie.lovable.app";

export default function Auteur() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useAuthorPublications(slug);

  const authorName = useMemo(() => {
    if (data && data.length > 0) return data[0].author;
    if (!slug) return "";
    // Fallback: prettify the slug
    return slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }, [data, slug]);

  if (!slug) return <Navigate to="/bibliotheque" replace />;

  const url = `${SITE_URL}/auteur/${slug}`;
  const description = data && data.length > 0
    ? `${authorName} — auteur publié chez KMG Bibliothèque. Découvrez ${data.length} publication${data.length > 1 ? "s" : ""} : livres, mémoires, TFC et articles académiques.`
    : `${authorName} — auteur publié chez KMG Bibliothèque.`;

  const jsonLd: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "Person",
      name: authorName,
      url,
      jobTitle: "Auteur",
      worksFor: {
        "@type": "Organization",
        name: "KMG Bibliothèque",
        url: SITE_URL,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Accueil", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Auteurs", item: `${SITE_URL}/bibliotheque` },
        { "@type": "ListItem", position: 3, name: authorName, item: url },
      ],
    },
  ];

  if (data && data.length > 0) {
    jsonLd.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: data.slice(0, 20).map((p, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: `${SITE_URL}/publication/${p.id}`,
        name: p.title,
      })),
    });
  }

  return (
    <Layout>
      <SEO
        title={`${authorName} — Auteur`}
        description={description}
        path={`/auteur/${slug}`}
        type="profile"
        keywords={[authorName, "auteur", "publications", "KMG Bibliothèque", "bibliothèque"]}
        jsonLd={jsonLd}
      />
      <div className="container py-8 md:py-12">
        <Breadcrumb
          items={[
            { label: "Bibliothèque", to: "/bibliotheque" },
            { label: authorName },
          ]}
        />

        <Link
          to="/bibliotheque"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la bibliothèque
        </Link>

        <header className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                {authorName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data?.length ?? 0} publication{(data?.length ?? 0) > 1 ? "s" : ""} chez KMG Bibliothèque
              </p>
            </div>
          </div>
          <p className="text-muted-foreground max-w-3xl leading-relaxed">
            Retrouvez toutes les publications de <strong>{authorName}</strong> sur KMG Bibliothèque :
            livres, mémoires, travaux de fin de cycle et articles académiques. Une sélection
            d'œuvres pour soutenir la recherche, l'enseignement et le partage du savoir.
          </p>
        </header>

        {isLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted rounded-lg animate-pulse" />
            ))}
          </div>
        ) : data && data.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {data.map((p) => (
              <PublicationCard
                key={p.id}
                id={p.id}
                title={p.title}
                author={p.author}
                description={p.description || undefined}
                category={p.category as any}
                coverImageUrl={p.cover_image_url || undefined}
                viewsCount={p.views_count || 0}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-6">
              Aucune publication trouvée pour cet auteur.
            </p>
            <Button asChild variant="outline">
              <Link to="/bibliotheque">Parcourir la bibliothèque</Link>
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}

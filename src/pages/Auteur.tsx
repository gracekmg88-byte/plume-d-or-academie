import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft, User } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { SEO } from "@/components/seo/SEO";
import { authorSeo, type SeoPublication } from "@/seo/pageSeo";
import { Breadcrumb } from "@/components/publications/Breadcrumb";
import { PublicationCard } from "@/components/publications/PublicationCard";
import { useAuthorPublications } from "@/hooks/useAuthorPublications";
import { useAuthorProfile } from "@/hooks/useAuthorProfiles";


export default function Auteur() {
  const { slug } = useParams<{ slug: string }>();
  const { data, isLoading } = useAuthorPublications(slug);
  const { data: profile } = useAuthorProfile(slug);

  const authorName = useMemo(() => {
    if (data && data.length > 0) return data[0].author;
    if (!slug) return "";
    // Fallback: prettify the slug
    return slug.split("-").map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(" ");
  }, [data, slug]);

  if (!slug) return <Navigate to="/bibliotheque" replace />;

  // Balises de référencement : même module que les pages prérendues et les Pages Functions
  // (src/seo/pageSeo.ts). Aucune donnée inventée : nom + liste réelle des publications.
  const seoPage = data && data.length > 0 ? authorSeo(authorName, data as SeoPublication[], profile) : null;

  return (
    <Layout>
      <SEO
        title={seoPage?.title ?? `${authorName} — Auteur`}
        description={seoPage?.description ?? `${authorName} sur KMG Bibliothèque.`}
        path={seoPage?.path ?? `/auteur/${slug}`}
        type="profile"
        image={seoPage?.image}
        keywords={[authorName, "auteur", "publications", "KMG Bibliothèque"]}
        jsonLd={seoPage?.jsonLd}
        noindex={(!isLoading && !seoPage) || !!seoPage?.noindex}
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
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-4">
            {profile?.photo_url ? (
              <img
                src={profile.photo_url}
                alt={`Photo de ${authorName}`}
                width={112}
                height={112}
                className="h-24 w-24 sm:h-28 sm:w-28 rounded-full object-cover border-2 border-primary/30 shadow-sm shrink-0"
              />
            ) : (
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="h-7 w-7 text-primary" />
              </div>
            )}
            <div>
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-foreground">
                {authorName}
              </h1>
              <p className="text-sm text-muted-foreground">
                {data?.length ?? 0} publication{(data?.length ?? 0) > 1 ? "s" : ""} chez KMG Bibliothèque
              </p>
            </div>
          </div>
          {profile?.biography ? (
            <section aria-labelledby="biographie" className="max-w-3xl">
              <h2 id="biographie" className="font-serif text-xl font-semibold text-foreground mb-2">Biographie</h2>
              {profile.biography
                .split(/\r?\n\s*\r?\n/)
                .map((para) => para.trim())
                .filter(Boolean)
                .map((para, i) => (
                  <p key={i} className="text-muted-foreground leading-relaxed mb-3 whitespace-pre-line">
                    {para}
                  </p>
                ))}
            </section>
          ) : (
            <p className="text-muted-foreground max-w-3xl leading-relaxed">
              Retrouvez toutes les publications de <strong>{authorName}</strong> sur KMG Bibliothèque :
              livres, mémoires, travaux de fin de cycle et articles académiques. Une sélection
              d'œuvres pour soutenir la recherche, l'enseignement et le partage du savoir.
            </p>
          )}
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

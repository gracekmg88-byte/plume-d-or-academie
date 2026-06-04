# Plan SEO complet — KMG Bibliothèque

## Objectif
Permettre aux livres et auteurs de remonter dans Google avec rich results (couverture, titre, auteur, description).

## Aperçu de l'existant
- Route actuelle : `/publication/:id` (UUID ou numéro)
- Composant `SEO` (react-helmet-async) déjà en place avec OG + Twitter + JSON-LD `Book`/`ScholarlyArticle`
- `scripts/generate-sitemap.ts` génère `public/sitemap.xml` au predev/prebuild avec toutes les publications publiées

## Nouveautés à livrer

### 1. URLs SEO-friendly avec slug
- Nouvelles routes :
  - `/livre/:slug` (livres)
  - `/memoire/:slug`, `/tfc/:slug`, `/article/:slug` (autres catégories)
  - `/auteur/:slug` (page auteur)
- Conserver `/publication/:id` → redirection 301-like (`<Navigate replace>`) vers la nouvelle URL canonique
- Slug généré côté client à partir de `title` + suffixe court d'ID pour garantir l'unicité (ex: `mon-livre-ab12`). Pas de migration BDD nécessaire — résolution par scan `title ilike`.
- Helper `src/lib/slug.ts` : `slugify(title)`, `buildPublicationPath(pub)`, `parseSlugId(slug)`, `slugifyAuthor(name)`

### 2. Métadonnées SEO enrichies par livre
Dans `Publication.tsx`, étendre `<SEO>` :
- `title` : `Titre — Auteur | KMG Bibliothèque`
- `description` : description ou résumé (160 car. max)
- `keywords` (ajouter dans `SEO.tsx`) : titre, auteur, catégorie, mots-clés détectés
- Canonical pointant vers la nouvelle URL `/livre/slug`

### 3. Open Graph livre
- `og:type=book` pour catégorie livre (déjà partiellement fait)
- `og:title`, `og:description`, `og:image` (cover_image_url), `og:url`
- `book:author`, `book:isbn` si disponible

### 4. Twitter Card
- `summary_large_image` (déjà OK dans `SEO.tsx`)

### 5. JSON-LD Schema.org Book enrichi
```json
{
  "@type": "Book",
  "name": "...", "author": {"@type":"Person","name":"...","url":"/auteur/slug"},
  "description": "...", "image": "...", "datePublished": "...",
  "publisher": {"@type":"Organization","name":"KMG Bibliothèque","url":"..."},
  "inLanguage": "fr", "url": "https://.../livre/slug",
  "bookFormat": "EBook", "isAccessibleForFree": true
}
```

### 6. Sitemap.xml mis à jour
- Modifier `scripts/generate-sitemap.ts` :
  - Émettre les nouvelles URLs `/livre/slug`, `/memoire/slug`, etc.
  - Ajouter les URLs auteurs uniques `/auteur/slug`
  - Conserver `image:image` (cover) dans chaque entrée pour Google Images

### 7. Slug propre
- Helper `slugify` (NFKD, retire accents, lowercase, tirets)

### 8. Fil d'Ariane (Breadcrumb)
- Composant `Breadcrumb` visuel en haut de la page livre/auteur
- JSON-LD `BreadcrumbList` (Accueil > Bibliothèque > Catégorie > Titre)

### 9. Canonical
- Sur chaque page livre/auteur via `<SEO path>` → déjà géré, vérifier la suppression du doublon dans `index.html` (déjà supprimé : `index.html` actuel — vérifier)

### 10. Rich Results JSON-LD
- Couvert par 5 + 8

### 11. Optimisation images de couverture
- `CachedImage` déjà utilisé. Ajouter `loading="eager"` pour la couverture LCP, `fetchPriority="high"`, dimensions explicites
- Préciser `width/height` pour CLS

### 12. ALT automatique
- ALT = `"Couverture du livre {title} par {author}"` (déjà partiellement, harmoniser)

### 13. Section "Livres similaires"
- Nouveau composant `SimilarBooks.tsx` (même catégorie + même auteur, 4-6 résultats, exclure courant)
- Hook `useSimilarPublications(id)` 
- Liens internes → maillage

### 14. Pages auteur
- Nouvelle page `src/pages/Auteur.tsx` route `/auteur/:slug`
- Récupère toutes publications où `author` slug matche
- Affiche : nom, bio (générique si pas en BDD : "Auteur publié chez KMG Bibliothèque"), grille de ses livres
- JSON-LD `Person` + `ItemList`
- SEO complet + canonical
- Liens cliquables sur l'auteur depuis chaque page livre

### 15. Indexation moteurs
- `robots.txt` : autoriser `/livre`, `/auteur`, `/memoire`, `/tfc`, `/article` (déjà Allow: / par défaut, OK)
- Vérifier que `Disallow: /admin` ne bloque pas le reste

### 16. Validation Rich Results
- Documenter les URLs à tester sur https://search.google.com/test/rich-results dans une note finale (pas d'automatisation possible côté client)

## Fichiers à créer
- `src/lib/slug.ts`
- `src/pages/Auteur.tsx`
- `src/components/publications/SimilarBooks.tsx`
- `src/components/publications/Breadcrumb.tsx`
- `src/hooks/useSimilarPublications.ts`
- `src/hooks/useAuthorPublications.ts`

## Fichiers à modifier
- `src/App.tsx` (nouvelles routes + redirection `/publication/:id` → slug)
- `src/pages/Publication.tsx` (SEO enrichi, breadcrumb, livres similaires, lien auteur, slug guard)
- `src/components/seo/SEO.tsx` (support `keywords`, balises `book:*`)
- `scripts/generate-sitemap.ts` (nouvelles URLs + image:image)
- `src/components/publications/PublicationCard.tsx` (liens vers nouvelles URLs slug)

## Notes techniques
- Pas de migration BDD (slug calculé). Pour stabilité du slug long terme on inclut un suffixe court de l'UUID.
- react-helmet-async injecte côté client : suffisant pour Googlebot. Les crawlers sociaux (LinkedIn/Facebook) verront le head de `index.html` — c'est une limite connue du SPA Vite.
- Pour les images : Google Images bénéficie de l'entrée `<image:image>` dans le sitemap.

Souhaitez-vous que je lance l'implémentation complète ?

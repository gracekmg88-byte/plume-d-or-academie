-- Profils des auteurs : biographie et photo, affichées sur les pages /auteur/<slug>
-- et utilisées pour le référencement (JSON-LD Person, Open Graph).
--
-- L'auteur d'une publication reste le texte publications.author ; un profil est rattaché
-- par son slug (même calcul que l'URL : src/lib/slug.ts → slugify). Lecture publique,
-- écriture réservée aux administrateurs. Les photos vont dans le bucket public
-- « publications », dossier authors/ (politiques d'écriture admin déjà en place).

CREATE TABLE IF NOT EXISTS public.authors (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 80),
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 300),
  biography   text CHECK (biography IS NULL OR length(biography) <= 10000),
  photo_url   text CHECK (photo_url IS NULL OR photo_url ~ '^https://'),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.authors IS 'Profils publics des auteurs (biographie, photo), rattachés aux publications par le slug du nom.';

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Profils auteurs lisibles par tous" ON public.authors;
CREATE POLICY "Profils auteurs lisibles par tous"
  ON public.authors FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Admins ajoutent des profils auteurs" ON public.authors;
CREATE POLICY "Admins ajoutent des profils auteurs"
  ON public.authors FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins modifient des profils auteurs" ON public.authors;
CREATE POLICY "Admins modifient des profils auteurs"
  ON public.authors FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "Admins suppriment des profils auteurs" ON public.authors;
CREATE POLICY "Admins suppriment des profils auteurs"
  ON public.authors FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

GRANT SELECT ON public.authors TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.authors TO authenticated;

DROP TRIGGER IF EXISTS update_authors_updated_at ON public.authors;
CREATE TRIGGER update_authors_updated_at
  BEFORE UPDATE ON public.authors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

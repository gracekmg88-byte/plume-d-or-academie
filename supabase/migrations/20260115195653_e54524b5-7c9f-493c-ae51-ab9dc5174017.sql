-- Enum pour les catégories de contenu
CREATE TYPE public.content_category AS ENUM ('livre', 'memoire', 'tfc', 'article');

-- Table principale des publications
CREATE TABLE public.publications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  description TEXT,
  category public.content_category NOT NULL,
  cover_image_url TEXT,
  file_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  views_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.publications ENABLE ROW LEVEL SECURITY;

-- Politique publique pour lecture des publications publiées
CREATE POLICY "Publications publiées visibles par tous"
ON public.publications
FOR SELECT
USING (is_published = true);

-- Politique pour admin - tout accès
CREATE POLICY "Admin peut tout gérer"
ON public.publications
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger pour updated_at
CREATE TRIGGER update_publications_updated_at
BEFORE UPDATE ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Fonction pour incrémenter les vues
CREATE OR REPLACE FUNCTION public.increment_views(publication_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.publications
  SET views_count = views_count + 1
  WHERE id = publication_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Créer le bucket de stockage pour les fichiers
INSERT INTO storage.buckets (id, name, public) VALUES ('publications', 'publications', true);

-- Politique de stockage - lecture publique
CREATE POLICY "Fichiers publics accessibles"
ON storage.objects
FOR SELECT
USING (bucket_id = 'publications');

-- Politique de stockage - upload pour authentifiés
CREATE POLICY "Upload pour authentifiés"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'publications');

-- Politique de stockage - suppression pour authentifiés
CREATE POLICY "Suppression pour authentifiés"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'publications');

-- Politique de stockage - mise à jour pour authentifiés
CREATE POLICY "Mise à jour pour authentifiés"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'publications');
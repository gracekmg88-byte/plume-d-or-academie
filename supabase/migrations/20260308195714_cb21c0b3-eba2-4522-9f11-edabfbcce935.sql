
-- Table des commentaires
CREATE TABLE public.comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  user_name TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_comments_publication ON public.comments (publication_id, created_at DESC);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- Tout le monde peut lire les commentaires
CREATE POLICY "Anyone can view comments"
  ON public.comments FOR SELECT
  USING (true);

-- Les utilisateurs connectés peuvent ajouter un commentaire
CREATE POLICY "Authenticated users can insert comments"
  ON public.comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Les utilisateurs peuvent supprimer leurs propres commentaires
CREATE POLICY "Users can delete own comments"
  ON public.comments FOR DELETE
  USING (auth.uid() = user_id);

-- Les admins peuvent supprimer n'importe quel commentaire
CREATE POLICY "Admins can delete any comment"
  ON public.comments FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

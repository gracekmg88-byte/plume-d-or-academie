-- Table pour stocker les messages du formulaire de contact
CREATE TABLE public.contact_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.contact_messages ENABLE ROW LEVEL SECURITY;

-- Policy: Tout le monde peut insérer un message
CREATE POLICY "Tout le monde peut envoyer un message"
ON public.contact_messages
FOR INSERT
WITH CHECK (true);

-- Policy: Seuls les admins peuvent voir les messages
CREATE POLICY "Admins peuvent voir les messages"
ON public.contact_messages
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins peuvent mettre à jour les messages (marquer comme lu)
CREATE POLICY "Admins peuvent mettre à jour les messages"
ON public.contact_messages
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins peuvent supprimer les messages
CREATE POLICY "Admins peuvent supprimer les messages"
ON public.contact_messages
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));
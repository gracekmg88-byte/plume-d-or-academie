-- Enum pour les rôles d'utilisateur
CREATE TYPE public.app_role AS ENUM ('admin');

-- Table des rôles utilisateurs (sécurisée)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Fonction pour vérifier si un utilisateur a un rôle spécifique
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Politique pour lire les rôles (admin uniquement)
CREATE POLICY "Admins peuvent voir les rôles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Supprimer l'ancienne politique trop permissive
DROP POLICY IF EXISTS "Admin peut tout gérer" ON public.publications;

-- Nouvelles politiques sécurisées pour publications
CREATE POLICY "Admin peut insérer des publications"
ON public.publications
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin peut modifier des publications"
ON public.publications
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin peut supprimer des publications"
ON public.publications
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin peut voir toutes les publications"
ON public.publications
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
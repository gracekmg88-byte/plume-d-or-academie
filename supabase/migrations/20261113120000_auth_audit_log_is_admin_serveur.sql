-- Journal des connexions : la colonne is_admin est désormais remplie par la base, pas par le navigateur.
--
-- Avant : le site envoyait is_admin vide (NULL) pour les connexions, déconnexions et sessions
-- restaurées ; les règles RLS (is_admin = false / is_admin = has_role(...)) rejetaient alors la ligne
-- (401 pour les visiteurs, 403 pour les utilisateurs connectés) et ces événements n'étaient jamais
-- enregistrés.
--
-- Après : avant chaque insertion venant du site (rôles anon et authenticated), la base calcule
-- elle-même is_admin d'après le vrai rôle de la personne. Les règles RLS existantes ne changent pas
-- (elles sont vérifiées après ce déclencheur) et un visiteur ne peut plus se déclarer administrateur.
-- Les insertions du serveur (service_role, ex. fonction verify-admin) gardent leur valeur.

CREATE OR REPLACE FUNCTION public.auth_audit_log_set_is_admin()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'anon' THEN
    NEW.is_admin := false;
  ELSIF current_user = 'authenticated' THEN
    NEW.is_admin := COALESCE(public.has_role(auth.uid(), 'admin'::app_role), false);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_audit_log_set_is_admin ON public.auth_audit_log;

CREATE TRIGGER auth_audit_log_set_is_admin
BEFORE INSERT ON public.auth_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.auth_audit_log_set_is_admin();

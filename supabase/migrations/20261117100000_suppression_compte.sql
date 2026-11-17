-- Suppression de compte par l'utilisateur (exigence Google Play et App Store).
-- Les paiements sont des pièces comptables : à la suppression d'un compte, on les conserve
-- en les détachant du compte (user_id = NULL) au lieu de les effacer.
ALTER TABLE public.payments ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_user_id_fkey;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

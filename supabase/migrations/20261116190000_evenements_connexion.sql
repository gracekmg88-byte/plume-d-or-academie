-- Journal léger d'événements techniques côté site (diagnostic), sans donnée personnelle :
-- ex. « le bouton Google direct n'a pas pu être utilisé, l'ancien bouton a pris le relais ».
-- Écriture : tout visiteur (anonyme ou connecté), uniquement des types connus et des textes courts.
-- Lecture : administrateurs seulement.
CREATE TABLE IF NOT EXISTS public.client_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL CHECK (kind IN ('google_gsi_fallback')),
  reason text CHECK (char_length(reason) <= 200),
  user_agent text CHECK (char_length(user_agent) <= 300)
);

ALTER TABLE public.client_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can log client events" ON public.client_events;
CREATE POLICY "Anyone can log client events"
  ON public.client_events FOR INSERT TO anon, authenticated
  WITH CHECK (kind = 'google_gsi_fallback');

DROP POLICY IF EXISTS "Admins can read client events" ON public.client_events;
CREATE POLICY "Admins can read client events"
  ON public.client_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

GRANT INSERT ON public.client_events TO anon, authenticated;
GRANT SELECT ON public.client_events TO authenticated;

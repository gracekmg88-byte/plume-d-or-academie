-- Premium — paiement par carte (OPTGateway) sur le site web.
-- Réglage d'ouverture au public : tant qu'il vaut 'false', seuls les administrateurs peuvent
-- lancer un paiement (tests avec la clé sk_test_). Lisible par l'application (affichage du bouton).
INSERT INTO public.site_settings (key, value, label, category)
SELECT 'opt_gateway_enabled', 'false', 'Paiement par carte (OPTGateway) ouvert aux clients', 'abonnement'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'opt_gateway_enabled');

DROP POLICY IF EXISTS "Public can view whitelisted settings" ON public.site_settings;
CREATE POLICY "Public can view whitelisted settings"
  ON public.site_settings FOR SELECT
  USING (key = ANY (ARRAY['allow_downloads', 'homepage_layout', 'library_layout', 'premium_enforced', 'opt_gateway_enabled']));

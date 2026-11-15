-- Premium — paiement Google Play (application Android, forfaits PRÉPAYÉS sans renouvellement auto).
-- Réglage d'ouverture : tant qu'il vaut 'false', seuls les administrateurs voient et peuvent
-- utiliser le paiement Google Play (tests avec un compte « testeur de licence »).
INSERT INTO public.site_settings (key, value, label, category)
SELECT 'google_play_enabled', 'false', 'Paiement Google Play (application Android) ouvert aux clients', 'abonnement'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'google_play_enabled');

DROP POLICY IF EXISTS "Public can view whitelisted settings" ON public.site_settings;
CREATE POLICY "Public can view whitelisted settings"
  ON public.site_settings FOR SELECT
  USING (key = ANY (ARRAY['allow_downloads', 'homepage_layout', 'library_layout', 'premium_enforced',
                          'opt_gateway_enabled', 'google_play_enabled']));

-- Identifiants à créer à l'identique dans la Play Console (Monétiser → Abonnements) :
-- produit « kmg_premium », forfaits de base prépayés « mensuel-prepaye » et « annuel-prepaye ».
UPDATE public.subscription_plans
   SET google_play_product_id = 'kmg_premium', google_play_base_plan_id = 'mensuel-prepaye'
 WHERE code = 'premium_monthly' AND google_play_product_id IS NULL;
UPDATE public.subscription_plans
   SET google_play_product_id = 'kmg_premium', google_play_base_plan_id = 'annuel-prepaye'
 WHERE code = 'premium_yearly' AND google_play_product_id IS NULL;

-- Premium — étape 2 : rappels automatiques d'expiration (J-7, J-3, jour de l'expiration).
-- La fonction serveur « subscription-reminders » est appelée chaque jour à 07:00 UTC
-- (08:00 à Kinshasa) par pg_cron. Anti-doublon : table subscription_reminders
-- (contrainte unique utilisateur + échéance + type de rappel).

-- Canaux réglables par l'administrateur (e-mail désactivé par défaut : à activer dans l'admin).
INSERT INTO public.site_settings (key, value, label, category)
SELECT 'premium_reminders_push', 'true', 'Rappels d''expiration : notification push', 'abonnement'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'premium_reminders_push');
INSERT INTO public.site_settings (key, value, label, category)
SELECT 'premium_reminders_email', 'false', 'Rappels d''expiration : e-mail', 'abonnement'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'premium_reminders_email');

-- Tâche quotidienne
DO $$
BEGIN
  PERFORM cron.unschedule('premium-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule(
  'premium-reminders',
  '0 7 * * *',
  $$ SELECT private.call_edge_function('subscription-reminders', '{}'::jsonb); $$
);

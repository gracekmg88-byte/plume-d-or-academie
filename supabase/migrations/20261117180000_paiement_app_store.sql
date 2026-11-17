-- App Store (application iPhone) : nouveau prestataire « apple_iap » pour les paiements Premium.
-- Préparé le 2026-11-17, À APPLIQUER seulement quand le compte Apple Developer sera ouvert
-- (en même temps que la mise en ligne de la fonction apple-iap-verify).
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_provider_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_payment_provider_check
  CHECK (payment_provider = ANY (ARRAY['google_play'::text, 'opt_gateway'::text, 'apple_iap'::text]));
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_payment_provider_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_payment_provider_check
  CHECK (payment_provider = ANY (ARRAY['google_play'::text, 'opt_gateway'::text, 'admin'::text, 'apple_iap'::text]));

-- Réglage d'ouverture (désactivé : seuls les administrateurs peuvent tester).
INSERT INTO public.site_settings (key, value, label, category)
VALUES ('apple_iap_enabled', 'false', 'Paiement App Store (application iPhone) ouvert aux clients', 'abonnement')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.apply_paid_period(_user_id uuid, _plan_id uuid, _provider text, _provider_reference text, _amount numeric, _currency text, _provider_data jsonb DEFAULT NULL::jsonb)
 RETURNS subscriptions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  plan public.subscription_plans;
  existing public.subscriptions;
  current_end timestamptz;
  period_start timestamptz;
  sub public.subscriptions;
BEGIN
  IF _provider NOT IN ('google_play', 'opt_gateway', 'apple_iap') THEN
    RAISE EXCEPTION 'Prestataire inconnu : %', _provider;
  END IF;
  -- Verrou par utilisateur : deux confirmations simultanées ne se chevauchent pas.
  PERFORM pg_advisory_xact_lock(hashtext('kmg-premium-' || _user_id::text));

  SELECT * INTO existing FROM public.subscriptions
   WHERE payment_provider = _provider AND provider_reference = _provider_reference;
  IF FOUND THEN
    RETURN existing;  -- déjà activé : aucune double activation
  END IF;

  SELECT * INTO plan FROM public.subscription_plans WHERE id = _plan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Formule introuvable'; END IF;

  -- Les jours restants s'ajoutent : la période commence à la fin de l'abonnement en cours.
  SELECT max(expires_at) INTO current_end FROM public.subscriptions
   WHERE user_id = _user_id AND status = 'active' AND expires_at > now();
  period_start := greatest(now(), coalesce(current_end, now()));

  INSERT INTO public.subscriptions (user_id, plan_id, payment_provider, provider_reference, status, started_at, expires_at)
  VALUES (_user_id, _plan_id, _provider, _provider_reference, 'active', period_start,
          period_start + make_interval(days => plan.duration_days))
  RETURNING * INTO sub;

  INSERT INTO public.payments (user_id, plan_id, subscription_id, payment_provider, provider_reference,
                               amount, currency, status, provider_data, confirmed_at)
  VALUES (_user_id, _plan_id, sub.id, _provider, _provider_reference, _amount, _currency, 'succeeded', _provider_data, now())
  ON CONFLICT (payment_provider, provider_reference) DO UPDATE
    SET subscription_id = EXCLUDED.subscription_id, status = 'succeeded', amount = EXCLUDED.amount,
        currency = EXCLUDED.currency, provider_data = coalesce(EXCLUDED.provider_data, public.payments.provider_data),
        confirmed_at = now(), updated_at = now(), failure_reason = NULL;

  PERFORM public.refresh_premium_status(_user_id);
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_value)
  VALUES (_user_id, 'premium_period_paid', 'subscriptions', sub.id,
          _provider || ' ' || _provider_reference || ' → ' || sub.expires_at::text);
  RETURN sub;
END;
$function$;

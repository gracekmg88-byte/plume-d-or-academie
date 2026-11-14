-- ═══════════════════════════════════════════════════════════════════════════════════════
-- Abonnement Premium avec renouvellement manuel — étape 1 : socle de données et sécurité.
--
-- Principe : chaque paiement confirmé crée une PÉRIODE dans `subscriptions`
-- (started_at → expires_at). Une nouvelle période commence à la fin de la période en cours
-- (les jours restants ne sont jamais perdus) ou maintenant si l'abonnement a expiré.
-- Le statut Premium d'un compte = au moins une période active couvrant l'instant présent.
-- `user_profiles.subscription_type` (utilisé partout dans l'application) est tenu à jour
-- par la base ; ni l'utilisateur ni l'interface ne peuvent le modifier directement.
--
-- Aucune donnée existante n'est supprimée. Les 2 comptes Premium actuels reçoivent une
-- période « admin » sans date de fin (à ajuster dans l'admin).
-- ═══════════════════════════════════════════════════════════════════════════════════════

-- ─── 1. Formules ────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                     text NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_]{2,40}$'),
  name                     text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  description              text CHECK (description IS NULL OR length(description) <= 2000),
  duration_days            integer NOT NULL CHECK (duration_days BETWEEN 1 AND 3660),
  price_amount             numeric(12,2) CHECK (price_amount IS NULL OR price_amount >= 0),
  currency                 text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  google_play_product_id   text CHECK (google_play_product_id IS NULL OR length(google_play_product_id) <= 150),
  google_play_base_plan_id text CHECK (google_play_base_plan_id IS NULL OR length(google_play_base_plan_id) <= 150),
  is_active                boolean NOT NULL DEFAULT false,
  sort_order               integer NOT NULL DEFAULT 0,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now(),
  -- Une formule proposée aux clients doit avoir un prix.
  CONSTRAINT subscription_plans_active_needs_price CHECK (NOT is_active OR price_amount IS NOT NULL)
);
COMMENT ON TABLE public.subscription_plans IS 'Formules Premium (durée, prix, identifiants Google Play), modifiables par les administrateurs.';

INSERT INTO public.subscription_plans (code, name, description, duration_days, sort_order)
VALUES
  ('premium_monthly', 'Premium mensuel', 'Accès Premium pendant 30 jours, sans renouvellement automatique.', 30, 1),
  ('premium_yearly',  'Premium annuel',  'Accès Premium pendant 365 jours, sans renouvellement automatique.', 365, 2)
ON CONFLICT (code) DO NOTHING;

-- ─── 2. Périodes d'abonnement ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id             uuid REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  payment_provider    text NOT NULL CHECK (payment_provider IN ('google_play', 'opt_gateway', 'admin')),
  provider_reference  text CHECK (provider_reference IS NULL OR length(provider_reference) <= 300),
  status              text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'revoked')),
  started_at          timestamptz NOT NULL,
  expires_at          timestamptz,           -- NULL = sans date de fin (attribution admin uniquement)
  note                text CHECK (note IS NULL OR length(note) <= 500),
  created_by          uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT subscriptions_dates CHECK (expires_at IS NULL OR expires_at > started_at),
  CONSTRAINT subscriptions_paid_has_plan CHECK (payment_provider = 'admin' OR (plan_id IS NOT NULL AND provider_reference IS NOT NULL)),
  CONSTRAINT subscriptions_paid_has_end CHECK (payment_provider = 'admin' OR expires_at IS NOT NULL)
);
COMMENT ON TABLE public.subscriptions IS 'Périodes Premium : une ligne par paiement confirmé (ou attribution admin).';
-- Une référence de paiement ne peut créer qu'une seule période (anti double activation).
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_provider_ref_uniq
  ON public.subscriptions (payment_provider, provider_reference) WHERE provider_reference IS NOT NULL;
CREATE INDEX IF NOT EXISTS subscriptions_user_idx ON public.subscriptions (user_id, expires_at DESC);
CREATE INDEX IF NOT EXISTS subscriptions_status_exp_idx ON public.subscriptions (status, expires_at);

-- ─── 3. Paiements ───────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payments (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id             uuid REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  subscription_id     uuid REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  payment_provider    text NOT NULL CHECK (payment_provider IN ('google_play', 'opt_gateway')),
  provider_reference  text NOT NULL CHECK (length(provider_reference) BETWEEN 1 AND 300),
  amount              numeric(12,2) CHECK (amount IS NULL OR amount >= 0),
  currency            text CHECK (currency IS NULL OR currency ~ '^[A-Z]{3}$'),
  status              text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'succeeded', 'failed', 'cancelled', 'refunded')),
  failure_reason      text CHECK (failure_reason IS NULL OR length(failure_reason) <= 1000),
  -- Données techniques du prestataire, nettoyées : JAMAIS de numéro de carte complet.
  provider_data       jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  confirmed_at        timestamptz,
  CONSTRAINT payments_provider_ref_uniq UNIQUE (payment_provider, provider_reference)
);
COMMENT ON TABLE public.payments IS 'Historique des paiements (Google Play, OPT Gateway). Aucune donnée de carte complète.';
CREATE INDEX IF NOT EXISTS payments_user_idx ON public.payments (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx ON public.payments (status, created_at DESC);

-- ─── 4. Événements reçus des prestataires (webhooks, notifications Google) ─────────────
CREATE TABLE IF NOT EXISTS public.payment_events (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_provider  text NOT NULL CHECK (payment_provider IN ('google_play', 'opt_gateway')),
  event_id          text NOT NULL CHECK (length(event_id) BETWEEN 1 AND 300),
  event_type        text CHECK (event_type IS NULL OR length(event_type) <= 200),
  payload           jsonb,
  signature_valid   boolean,
  received_at       timestamptz NOT NULL DEFAULT now(),
  processed_at      timestamptz,
  processing_error  text CHECK (processing_error IS NULL OR length(processing_error) <= 2000),
  -- Un même événement n'est traité qu'une seule fois.
  CONSTRAINT payment_events_uniq UNIQUE (payment_provider, event_id)
);
CREATE INDEX IF NOT EXISTS payment_events_received_idx ON public.payment_events (received_at DESC);

-- ─── 5. Rappels envoyés (anti doublon ; utilisé à l'étape des rappels automatiques) ─────
CREATE TABLE IF NOT EXISTS public.subscription_reminders (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at       timestamptz NOT NULL,     -- échéance concernée par le rappel
  kind             text NOT NULL CHECK (kind IN ('j7', 'j3', 'j0', 'expired')),
  channels         text[] NOT NULL DEFAULT '{}',
  notification_id  uuid REFERENCES public.notifications(id) ON DELETE SET NULL,
  sent_at          timestamptz NOT NULL DEFAULT now(),
  error            text,
  CONSTRAINT subscription_reminders_uniq UNIQUE (user_id, expires_at, kind)
);

-- ─── 6. Publications : gratuit / réservé aux abonnés ────────────────────────────────────
ALTER TABLE public.publications
  ADD COLUMN IF NOT EXISTS access_level text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS premium_file_path text;
DO $$ BEGIN
  ALTER TABLE public.publications
    ADD CONSTRAINT publications_access_level_chk CHECK (access_level IN ('free', 'premium'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
COMMENT ON COLUMN public.publications.access_level IS 'free = lecture libre ; premium = réservé aux abonnés (fichier dans le bucket privé premium-files).';
COMMENT ON COLUMN public.publications.premium_file_path IS 'Chemin du PDF dans le bucket privé premium-files (livres Premium). Lien temporaire délivré par la fonction get-reading-url.';

-- Bucket privé des PDF Premium : aucun accès direct ; lecture uniquement via liens signés
-- délivrés par la fonction serveur après vérification de l'abonnement.
INSERT INTO storage.buckets (id, name, public)
VALUES ('premium-files', 'premium-files', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Admins gerent les fichiers premium" ON storage.objects;
CREATE POLICY "Admins gerent les fichiers premium"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'premium-files' AND public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (bucket_id = 'premium-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

-- Réglage : contrôle Premium appliqué ou non (tant qu'il est désactivé, tout le monde lit tout,
-- comme aujourd'hui). Lisible par tous (l'application en a besoin), modifiable par l'admin.
INSERT INTO public.site_settings (key, value, label, category)
SELECT 'premium_enforced', 'false', 'Réserver les livres Premium aux abonnés', 'abonnement'
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'premium_enforced');

DROP POLICY IF EXISTS "Public can view whitelisted settings" ON public.site_settings;
CREATE POLICY "Public can view whitelisted settings"
  ON public.site_settings FOR SELECT
  USING (key = ANY (ARRAY['allow_downloads', 'homepage_layout', 'library_layout', 'premium_enforced']));

-- ─── 7. Fonctions : statut Premium, attribution, synchronisation ────────────────────────
-- Premium = une période active qui couvre maintenant.
CREATE OR REPLACE FUNCTION public.user_has_premium(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.user_id = _user_id
      AND s.status = 'active'
      AND s.started_at <= now()
      AND (s.expires_at IS NULL OR s.expires_at > now())
  );
$$;

-- Fin de l'abonnement en cours (NULL = aucun abonnement actif ; 'infinity' = sans date de fin).
CREATE OR REPLACE FUNCTION public.premium_expires_at(_user_id uuid)
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT CASE
    WHEN bool_or(s.expires_at IS NULL) THEN 'infinity'::timestamptz
    ELSE max(s.expires_at)
  END
  FROM public.subscriptions s
  WHERE s.user_id = _user_id AND s.status = 'active'
    AND (s.expires_at IS NULL OR s.expires_at > now());
$$;

-- Recopie le statut calculé dans user_profiles.subscription_type (seule voie autorisée).
CREATE OR REPLACE FUNCTION public.refresh_premium_status(_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_type text := CASE WHEN public.user_has_premium(_user_id) THEN 'premium' ELSE 'free' END;
BEGIN
  PERFORM set_config('kmg.premium_sync', 'on', true);
  UPDATE public.user_profiles
     SET subscription_type = new_type::public.subscription_type,
         subscription_updated_at = now()
   WHERE user_id = _user_id
     AND subscription_type::text IS DISTINCT FROM new_type;
  PERFORM set_config('kmg.premium_sync', 'off', true);
END;
$$;

-- Tâche planifiée : passe en « expired » les périodes terminées et resynchronise les statuts.
CREATE OR REPLACE FUNCTION public.refresh_all_premium_status()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  changed integer := 0;
  r record;
BEGIN
  UPDATE public.subscriptions SET status = 'expired', updated_at = now()
   WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= now();

  FOR r IN
    SELECT p.user_id,
           p.subscription_type::text AS current_type,
           CASE WHEN public.user_has_premium(p.user_id) THEN 'premium' ELSE 'free' END AS expected
      FROM public.user_profiles p
  LOOP
    IF r.current_type IS DISTINCT FROM r.expected THEN
      PERFORM public.refresh_premium_status(r.user_id);
      INSERT INTO public.audit_log (user_id, action, table_name, record_id, old_value, new_value)
      VALUES (r.user_id, 'premium_status_sync', 'user_profiles', r.user_id, r.current_type, r.expected);
      changed := changed + 1;
    END IF;
  END LOOP;
  RETURN changed;
END;
$$;

-- Ajoute une période payée (appelée UNIQUEMENT par les fonctions serveur, après vérification
-- du paiement auprès du prestataire). Idempotente : une même référence n'active qu'une fois.
CREATE OR REPLACE FUNCTION public.apply_paid_period(
  _user_id uuid,
  _plan_id uuid,
  _provider text,
  _provider_reference text,
  _amount numeric,
  _currency text,
  _provider_data jsonb DEFAULT NULL
)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  plan public.subscription_plans;
  existing public.subscriptions;
  current_end timestamptz;
  period_start timestamptz;
  sub public.subscriptions;
BEGIN
  IF _provider NOT IN ('google_play', 'opt_gateway') THEN
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
$$;

-- Attribution manuelle par un administrateur (nombre de jours, ou NULL = sans date de fin).
CREATE OR REPLACE FUNCTION public.admin_grant_premium(_user_id uuid, _days integer DEFAULT NULL, _note text DEFAULT NULL)
RETURNS public.subscriptions
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  current_end timestamptz;
  period_start timestamptz;
  sub public.subscriptions;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  IF _days IS NOT NULL AND (_days < 1 OR _days > 3660) THEN
    RAISE EXCEPTION 'Durée invalide (1 à 3660 jours)';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('kmg-premium-' || _user_id::text));
  SELECT max(expires_at) INTO current_end FROM public.subscriptions
   WHERE user_id = _user_id AND status = 'active' AND expires_at > now();
  period_start := greatest(now(), coalesce(current_end, now()));

  INSERT INTO public.subscriptions (user_id, payment_provider, status, started_at, expires_at, note, created_by)
  VALUES (_user_id, 'admin', 'active', period_start,
          CASE WHEN _days IS NULL THEN NULL ELSE period_start + make_interval(days => _days) END,
          left(_note, 500), auth.uid())
  RETURNING * INTO sub;

  PERFORM public.refresh_premium_status(_user_id);
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_value)
  VALUES (auth.uid(), 'admin_grant_premium', 'subscriptions', sub.id,
          _user_id::text || ' : ' || coalesce(_days::text || ' jours', 'sans date de fin'));
  RETURN sub;
END;
$$;

-- Retrait manuel par un administrateur : toutes les périodes actives sont révoquées.
CREATE OR REPLACE FUNCTION public.admin_revoke_premium(_user_id uuid, _note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Réservé aux administrateurs' USING ERRCODE = '42501';
  END IF;
  UPDATE public.subscriptions
     SET status = 'revoked', updated_at = now(),
         note = left(coalesce(note || ' · ', '') || 'Révoqué' || coalesce(' : ' || _note, ''), 500)
   WHERE user_id = _user_id AND status = 'active';
  GET DIAGNOSTICS n = ROW_COUNT;
  PERFORM public.refresh_premium_status(_user_id);
  INSERT INTO public.audit_log (user_id, action, table_name, record_id, new_value)
  VALUES (auth.uid(), 'admin_revoke_premium', 'subscriptions', _user_id, n::text || ' période(s) révoquée(s)');
  RETURN n;
END;
$$;

-- Droits d'exécution : seuls le serveur (service_role) et, pour les fonctions admin, les comptes
-- connectés (la fonction vérifie elle-même le rôle admin).
REVOKE ALL ON FUNCTION public.refresh_premium_status(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_premium_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_paid_period(uuid, uuid, text, text, numeric, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_grant_premium(uuid, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_premium(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.premium_expires_at(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.refresh_premium_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_all_premium_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_paid_period(uuid, uuid, text, text, numeric, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_grant_premium(uuid, integer, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_revoke_premium(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_premium(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.premium_expires_at(uuid) TO authenticated, service_role;

-- ─── 8. Personne ne modifie subscription_type à la main (même pas l'admin via l'API) ────
CREATE OR REPLACE FUNCTION public.guard_subscription_type()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public
AS $$
BEGIN
  IF NEW.subscription_type IS DISTINCT FROM OLD.subscription_type
     AND coalesce(current_setting('kmg.premium_sync', true), 'off') <> 'on' THEN
    RAISE EXCEPTION 'Le statut Premium se modifie uniquement via un paiement vérifié ou admin_grant_premium / admin_revoke_premium'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_subscription_type ON public.user_profiles;
CREATE TRIGGER guard_subscription_type
  BEFORE UPDATE OF subscription_type ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_subscription_type();

-- ─── 9. Sécurité des tables (RLS) ───────────────────────────────────────────────────────
ALTER TABLE public.subscription_plans     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_reminders ENABLE ROW LEVEL SECURITY;

-- Formules : les formules actives sont visibles par tous ; l'admin voit et modifie tout.
DROP POLICY IF EXISTS "Formules actives visibles" ON public.subscription_plans;
CREATE POLICY "Formules actives visibles" ON public.subscription_plans FOR SELECT
  TO anon, authenticated USING (is_active OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins gerent les formules" ON public.subscription_plans;
CREATE POLICY "Admins gerent les formules" ON public.subscription_plans FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Abonnements et paiements : lecture de ses propres lignes ; admin : lecture de tout.
-- AUCUNE écriture par l'API : uniquement via les fonctions ci-dessus (SECURITY DEFINER).
DROP POLICY IF EXISTS "Voir ses abonnements" ON public.subscriptions;
CREATE POLICY "Voir ses abonnements" ON public.subscriptions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Voir ses paiements" ON public.payments;
CREATE POLICY "Voir ses paiements" ON public.payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins voient les evenements de paiement" ON public.payment_events;
CREATE POLICY "Admins voient les evenements de paiement" ON public.payment_events FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));
DROP POLICY IF EXISTS "Admins voient les rappels" ON public.subscription_reminders;
CREATE POLICY "Admins voient les rappels" ON public.subscription_reminders FOR SELECT
  TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

REVOKE ALL ON public.subscriptions, public.payments, public.payment_events, public.subscription_reminders FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions, public.payments, public.payment_events, public.subscription_reminders FROM authenticated;
GRANT SELECT ON public.subscriptions, public.payments, public.payment_events, public.subscription_reminders TO authenticated;
GRANT SELECT ON public.subscription_plans TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.subscription_plans TO authenticated;

-- Horodatage automatique
DROP TRIGGER IF EXISTS update_subscription_plans_updated_at ON public.subscription_plans;
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 10. Comptes Premium existants : période admin sans date de fin ─────────────────────
INSERT INTO public.subscriptions (user_id, payment_provider, provider_reference, status, started_at, expires_at, note)
SELECT p.user_id, 'admin', 'legacy-' || p.user_id::text, 'active',
       coalesce(p.subscription_updated_at, p.created_at, now()), NULL,
       'Premium attribué avant le système d''abonnement (à ajuster)'
  FROM public.user_profiles p
 WHERE p.subscription_type::text = 'premium'
ON CONFLICT DO NOTHING;

-- ─── 11. Tâche planifiée : expirations, toutes les heures ───────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('premium-expirations');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
SELECT cron.schedule('premium-expirations', '7 * * * *', $$ SELECT public.refresh_all_premium_status(); $$);

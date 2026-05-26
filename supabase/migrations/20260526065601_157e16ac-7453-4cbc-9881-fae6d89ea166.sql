
-- 1) site_settings : restreindre les paramètres de paiement aux admins
DROP POLICY IF EXISTS "Settings are viewable by everyone" ON public.site_settings;
DROP POLICY IF EXISTS "Only admins can view site settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert settings" ON public.site_settings;
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;

CREATE POLICY "Public can view non-payment settings"
  ON public.site_settings FOR SELECT
  USING (category <> 'payment');

CREATE POLICY "Admins can view all settings"
  ON public.site_settings FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) notifications : empêcher l'insertion anonyme arbitraire
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

CREATE POLICY "Admins can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3) audit_log : seuls les admins peuvent insérer
DROP POLICY IF EXISTS "Authenticated users can insert audit logs" ON public.audit_log;

CREATE POLICY "Admins can insert audit logs"
  ON public.audit_log FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND auth.uid() = user_id);

-- 4) storage : bucket publications — écriture admin uniquement, lecture publique via URL directe seulement (pas de listing)
DROP POLICY IF EXISTS "Public can view publications" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can upload publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can update publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated can delete publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update publications" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete publications" ON storage.objects;

CREATE POLICY "Admins can insert into publications bucket"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'publications' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update publications bucket"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'publications' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete publications bucket"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'publications' AND public.has_role(auth.uid(), 'admin'));

-- 5) realtime : restreindre l'accès aux topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users receive their own notifications via realtime" ON realtime.messages;
DROP POLICY IF EXISTS "Authenticated users can subscribe to chat via realtime" ON realtime.messages;

CREATE POLICY "Authenticated can read realtime"
  ON realtime.messages FOR SELECT
  TO authenticated
  USING (true);

-- 6) Révoquer EXECUTE des fonctions SECURITY DEFINER internes (triggers uniquement)
REVOKE EXECUTE ON FUNCTION public.notify_users_new_chat_message() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_users_new_publication() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_chat_push() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_publication() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_contact() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_signup() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated, PUBLIC;

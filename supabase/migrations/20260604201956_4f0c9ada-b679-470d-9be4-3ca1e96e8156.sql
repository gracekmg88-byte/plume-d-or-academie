-- Tighten auth_audit_log INSERT policy
DROP POLICY IF EXISTS "Anyone can insert auth events" ON public.auth_audit_log;

CREATE POLICY "Authenticated users can log own auth events"
ON public.auth_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_admin = COALESCE(public.has_role(auth.uid(), 'admin'::app_role), false)
);

CREATE POLICY "Anonymous can log pre-auth events"
ON public.auth_audit_log
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND is_admin = false
);

-- Tighten site_settings public SELECT to a whitelist of safe keys
DROP POLICY IF EXISTS "Public can view non-payment settings" ON public.site_settings;

CREATE POLICY "Public can view whitelisted settings"
ON public.site_settings
FOR SELECT
USING (
  key IN ('allow_downloads', 'homepage_layout', 'library_layout')
);

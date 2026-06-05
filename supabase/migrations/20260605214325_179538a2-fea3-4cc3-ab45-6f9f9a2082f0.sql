
-- 1. Restrict increment_views to authenticated users
REVOKE EXECUTE ON FUNCTION public.increment_views(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_views(uuid) TO authenticated;

-- 2. Server-side enforcement of chat user_name from user_profiles
CREATE OR REPLACE FUNCTION public.enforce_chat_user_name()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  resolved_name TEXT;
BEGIN
  SELECT COALESCE(NULLIF(full_name, ''), email, 'Utilisateur')
    INTO resolved_name
  FROM public.user_profiles
  WHERE user_id = auth.uid();

  NEW.user_id := auth.uid();
  NEW.user_name := COALESCE(resolved_name, 'Utilisateur');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_chat_user_name_trigger ON public.chat_messages;
CREATE TRIGGER enforce_chat_user_name_trigger
  BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.enforce_chat_user_name();

-- 3. Tighten auth_audit_log INSERT policies: restrict event_type to known values
DROP POLICY IF EXISTS "Authenticated users can log own auth events" ON public.auth_audit_log;
DROP POLICY IF EXISTS "Anonymous can log pre-auth events" ON public.auth_audit_log;

CREATE POLICY "Authenticated users can log own auth events"
ON public.auth_audit_log
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND is_admin = COALESCE(public.has_role(auth.uid(), 'admin'::app_role), false)
  AND event_type IN (
    'sign_in','sign_out','token_refreshed','session_restored','session_lost',
    'admin_check','admin_check_failed','admin_route_denied','admin_route_granted'
  )
);

CREATE POLICY "Anonymous can log pre-auth events"
ON public.auth_audit_log
FOR INSERT
TO anon
WITH CHECK (
  user_id IS NULL
  AND is_admin = false
  AND event_type IN (
    'sign_in','sign_out','session_restored','session_lost',
    'admin_check_failed','admin_route_denied'
  )
);

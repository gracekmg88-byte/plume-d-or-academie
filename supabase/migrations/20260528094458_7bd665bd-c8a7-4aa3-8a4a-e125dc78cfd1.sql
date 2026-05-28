
-- 1. user_profiles: prevent self-escalation of subscription_type
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
ON public.user_profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND subscription_type = (SELECT subscription_type FROM public.user_profiles WHERE user_id = auth.uid())
  AND email = (SELECT email FROM public.user_profiles WHERE user_id = auth.uid())
  AND subscription_updated_at IS NOT DISTINCT FROM (SELECT subscription_updated_at FROM public.user_profiles WHERE user_id = auth.uid())
);

-- 2. audit_log: explicit deny insert for non-admin roles
CREATE POLICY "Block direct inserts into audit log"
ON public.audit_log
AS RESTRICTIVE
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

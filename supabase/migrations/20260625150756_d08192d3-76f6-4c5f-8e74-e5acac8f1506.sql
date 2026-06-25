
-- 1) Lock down SECURITY DEFINER helpers from direct API access.
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_premium(uuid) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_certificate_number(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.next_publication_number(text) FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.enforce_chat_user_name() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_signup() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_admin_on_contact() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_chat_push() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_new_publication() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_users_new_chat_message() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.notify_users_new_publication() FROM anon, authenticated, PUBLIC;

-- These remain callable: increment_views, increment_downloads (client RPC).
GRANT EXECUTE ON FUNCTION public.increment_views(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_downloads(uuid) TO anon, authenticated;

-- 2) Replace permissive INSERT policies with light input validation.
DROP POLICY IF EXISTS "Tout le monde peut envoyer un message" ON public.contact_messages;
CREATE POLICY "Tout le monde peut envoyer un message"
ON public.contact_messages FOR INSERT
WITH CHECK (
  char_length(coalesce(name, '')) BETWEEN 1 AND 120
  AND char_length(coalesce(email, '')) BETWEEN 3 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  AND char_length(coalesce(message, '')) BETWEEN 1 AND 5000
  AND char_length(coalesce(subject, '')) <= 200
);

DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.newsletter_subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
ON public.newsletter_subscribers FOR INSERT
WITH CHECK (
  char_length(coalesce(email, '')) BETWEEN 3 AND 254
  AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'
);

-- Fix 1: Remove INSERT policy on audit_log; writes should only come from SECURITY DEFINER paths
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.audit_log;

-- Fix 2: Tighten realtime policy — remove overly broad notifications% wildcard
DROP POLICY IF EXISTS "Users receive own notifications and chat via realtime" ON realtime.messages;
CREATE POLICY "Users receive own notifications and chat via realtime"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() = ('notifications:' || (auth.uid())::text))
  OR (realtime.topic() = 'chat_messages')
  OR (realtime.topic() ~~ 'realtime:public:chat_messages%')
);

-- Fix 3: Remove broad public SELECT on certificates bucket (files still accessible via public bucket URLs)
DROP POLICY IF EXISTS "Public read certificates bucket" ON storage.objects;
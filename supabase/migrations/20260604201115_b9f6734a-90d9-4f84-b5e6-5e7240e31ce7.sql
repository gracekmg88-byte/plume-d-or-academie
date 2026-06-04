
-- Auth audit log: traces session/role events
CREATE TABLE public.auth_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  email TEXT,
  event_type TEXT NOT NULL,
  is_admin BOOLEAN,
  metadata JSONB DEFAULT '{}'::jsonb,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_audit_log_user_id ON public.auth_audit_log(user_id);
CREATE INDEX idx_auth_audit_log_created_at ON public.auth_audit_log(created_at DESC);
CREATE INDEX idx_auth_audit_log_event_type ON public.auth_audit_log(event_type);

GRANT SELECT, INSERT ON public.auth_audit_log TO authenticated;
GRANT INSERT ON public.auth_audit_log TO anon;
GRANT ALL ON public.auth_audit_log TO service_role;

ALTER TABLE public.auth_audit_log ENABLE ROW LEVEL SECURITY;

-- Anyone (even anon) can insert log lines for their own events
CREATE POLICY "Anyone can insert auth events"
  ON public.auth_audit_log
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Users can read their own auth events
CREATE POLICY "Users can read their own auth events"
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can read all auth events
CREATE POLICY "Admins can read all auth events"
  ON public.auth_audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));


-- Table pour stocker les tokens FCM des appareils
CREATE TABLE public.device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'android',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Enable RLS
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can insert own tokens"
ON public.device_tokens FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own tokens"
ON public.device_tokens FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tokens"
ON public.device_tokens FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update own tokens"
ON public.device_tokens FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Admins can read all tokens (needed for sending notifications)
CREATE POLICY "Admins can view all tokens"
ON public.device_tokens FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Trigger updated_at
CREATE TRIGGER update_device_tokens_updated_at
BEFORE UPDATE ON public.device_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to notify on new publication
CREATE OR REPLACE FUNCTION public.notify_new_publication()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when publication is published
  IF NEW.is_published = true AND (OLD IS NULL OR OLD.is_published = false) THEN
    PERFORM net.http_post(
      url := 'https://vlqjdszawxtwutuzvskt.supabase.co/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'publication_id', NEW.id,
        'title', NEW.title,
        'author', NEW.author,
        'category', NEW.category
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach trigger to publications table (on insert and update)
CREATE TRIGGER trigger_notify_new_publication
AFTER INSERT OR UPDATE ON public.publications
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_publication();

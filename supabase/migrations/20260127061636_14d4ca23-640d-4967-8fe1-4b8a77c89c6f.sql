-- Create a database webhook to call the edge function on new user signup
-- Note: We'll trigger this from the user_profiles table which is populated on signup

-- First, enable the pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.notify_admin_on_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT := 'https://vlqjdszawxtwutuzvskt.supabase.co';
  service_role_key TEXT;
BEGIN
  -- Call the edge function to send the email notification
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-admin-signup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'user_profiles',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'email', NEW.email,
        'full_name', NEW.full_name,
        'subscription_type', NEW.subscription_type,
        'created_at', NEW.created_at
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger on user_profiles table
DROP TRIGGER IF EXISTS on_user_signup_notify_admin ON public.user_profiles;

CREATE TRIGGER on_user_signup_notify_admin
  AFTER INSERT ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_signup();
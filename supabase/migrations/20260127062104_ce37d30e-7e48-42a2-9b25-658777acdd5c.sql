-- Create the function that will be called by the trigger for contact messages
CREATE OR REPLACE FUNCTION public.notify_admin_on_contact()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url TEXT := 'https://vlqjdszawxtwutuzvskt.supabase.co';
BEGIN
  -- Call the edge function to send the email notification
  PERFORM net.http_post(
    url := supabase_url || '/functions/v1/notify-admin-contact',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'contact_messages',
      'record', jsonb_build_object(
        'id', NEW.id,
        'name', NEW.name,
        'email', NEW.email,
        'subject', NEW.subject,
        'message', NEW.message,
        'created_at', NEW.created_at
      )
    )
  );
  
  RETURN NEW;
END;
$$;

-- Create the trigger on contact_messages table
DROP TRIGGER IF EXISTS on_contact_notify_admin ON public.contact_messages;

CREATE TRIGGER on_contact_notify_admin
  AFTER INSERT ON public.contact_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_contact();
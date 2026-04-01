
-- Create a function to send push notifications for new chat messages
CREATE OR REPLACE FUNCTION public.notify_chat_push()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM net.http_post(
    url := 'https://vlqjdszawxtwutuzvskt.supabase.co/functions/v1/send-chat-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
    ),
    body := jsonb_build_object(
      'user_id', NEW.user_id,
      'user_name', NEW.user_name,
      'content', LEFT(NEW.content, 100)
    )
  );
  RETURN NEW;
END;
$$;

-- Create trigger on chat_messages
CREATE TRIGGER on_chat_message_push
AFTER INSERT ON public.chat_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_chat_push();

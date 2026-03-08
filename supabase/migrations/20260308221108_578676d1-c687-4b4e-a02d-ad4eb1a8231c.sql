CREATE OR REPLACE FUNCTION public.notify_users_new_chat_message()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, title, message, type, reference_id)
  SELECT
    up.user_id,
    '💬 Nouveau message',
    NEW.user_name || ' : ' || LEFT(NEW.content, 80),
    'chat',
    NULL
  FROM public.user_profiles up
  WHERE up.user_id != NEW.user_id
    AND NOT EXISTS (
      SELECT 1 FROM public.notification_preferences np
      WHERE np.user_id = up.user_id
        AND np.category = 'chat'
        AND np.enabled = false
    );

  RETURN NEW;
END;
$$;
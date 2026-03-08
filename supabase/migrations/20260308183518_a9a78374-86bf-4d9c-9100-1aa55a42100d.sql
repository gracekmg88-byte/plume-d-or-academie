
ALTER TABLE public.reading_history ADD COLUMN IF NOT EXISTS last_page_read INTEGER DEFAULT NULL;


-- Reading history table
CREATE TABLE public.reading_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reading_duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_reading_history_user_id ON public.reading_history(user_id);
CREATE INDEX idx_reading_history_publication_id ON public.reading_history(publication_id);

-- Enable RLS
ALTER TABLE public.reading_history ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reading records
CREATE POLICY "Users can insert own reading history"
  ON public.reading_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can view their own reading history
CREATE POLICY "Users can view own reading history"
  ON public.reading_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own reading records (for duration updates)
CREATE POLICY "Users can update own reading history"
  ON public.reading_history FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all reading history
CREATE POLICY "Admins can view all reading history"
  ON public.reading_history FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

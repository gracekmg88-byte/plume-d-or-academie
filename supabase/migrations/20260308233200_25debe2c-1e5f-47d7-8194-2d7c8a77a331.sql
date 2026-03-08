
-- 1. Annotations table for page-level notes and highlights
CREATE TABLE public.annotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  publication_id UUID NOT NULL REFERENCES public.publications(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#FDE047',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.annotations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own annotations" ON public.annotations FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own annotations" ON public.annotations FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own annotations" ON public.annotations FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own annotations" ON public.annotations FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Add summary column to publications
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS summary TEXT;

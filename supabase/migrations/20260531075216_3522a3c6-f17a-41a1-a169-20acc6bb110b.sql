ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS downloads_count integer NOT NULL DEFAULT 0;

CREATE OR REPLACE FUNCTION public.increment_downloads(publication_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.publications
  SET downloads_count = downloads_count + 1
  WHERE id = publication_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_downloads(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_downloads(uuid) TO authenticated;
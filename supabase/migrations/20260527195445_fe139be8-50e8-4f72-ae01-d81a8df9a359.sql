
ALTER TABLE public.publications ADD COLUMN IF NOT EXISTS publication_number TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS publications_publication_number_key ON public.publications(publication_number) WHERE publication_number IS NOT NULL;

-- New: publication number per category
CREATE OR REPLACE FUNCTION public.next_publication_number(_category text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT := to_char(now(), 'YYYY');
  cat_code TEXT;
  prefix TEXT;
  next_seq INT;
BEGIN
  cat_code := CASE lower(_category)
    WHEN 'livre' THEN 'LIV'
    WHEN 'memoire' THEN 'MEM'
    WHEN 'tfc' THEN 'TFC'
    WHEN 'article' THEN 'ART'
    ELSE 'PUB'
  END;
  prefix := 'KMG-' || cat_code || '-' || year_str || '-';

  SELECT COALESCE(MAX(CAST(SUBSTRING(publication_number FROM '([0-9]+)$') AS INT)), 0) + 1
    INTO next_seq
  FROM public.publications
  WHERE publication_number LIKE prefix || '%';

  RETURN prefix || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

-- Update certificate number: CERT-YYYY-NNN (global annual sequence, no category param needed but keep signature for compat)
CREATE OR REPLACE FUNCTION public.next_certificate_number(_category text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  year_str TEXT := to_char(now(), 'YYYY');
  prefix TEXT := 'CERT-' || year_str || '-';
  next_seq INT;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(certificate_number FROM '([0-9]+)$') AS INT)), 0) + 1
    INTO next_seq
  FROM public.certificates
  WHERE certificate_number LIKE prefix || '%';

  RETURN prefix || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

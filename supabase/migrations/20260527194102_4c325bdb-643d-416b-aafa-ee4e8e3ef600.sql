
-- 1. Enum statut certification
CREATE TYPE public.certification_status AS ENUM ('not_certified', 'pending', 'certified');

-- 2. Colonne statut sur publications
ALTER TABLE public.publications
  ADD COLUMN certification_status public.certification_status NOT NULL DEFAULT 'not_certified';

-- 3. Table certificates
CREATE TABLE public.certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  publication_id UUID NOT NULL UNIQUE,
  certificate_number TEXT NOT NULL UNIQUE,
  publication_number TEXT NOT NULL UNIQUE,
  verification_url TEXT NOT NULL,
  qr_code_url TEXT,
  certificate_pdf_url TEXT,
  status TEXT NOT NULL DEFAULT 'certified',
  publication_title TEXT NOT NULL,
  publication_author TEXT NOT NULL,
  publication_category TEXT NOT NULL,
  publication_date TIMESTAMPTZ NOT NULL,
  issued_by UUID NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_certificates_publication_id ON public.certificates(publication_id);
CREATE INDEX idx_certificates_number ON public.certificates(certificate_number);

GRANT SELECT ON public.certificates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificates TO authenticated;
GRANT ALL ON public.certificates TO service_role;

ALTER TABLE public.certificates ENABLE ROW LEVEL SECURITY;

-- Lecture publique (pour la page de vérification)
CREATE POLICY "Certificates are publicly viewable"
  ON public.certificates FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert certificates"
  ON public.certificates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update certificates"
  ON public.certificates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete certificates"
  ON public.certificates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_certificates_updated_at
  BEFORE UPDATE ON public.certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Bucket pour PDF et QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read certificates bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'certificates');

CREATE POLICY "Admins can upload certificates"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update certificates files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete certificates files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'certificates' AND public.has_role(auth.uid(), 'admin'));

-- 5. Fonction pour générer un numéro séquentiel KMG-{CAT}-{YEAR}-{NNN}
CREATE OR REPLACE FUNCTION public.next_certificate_number(_category TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  SELECT COALESCE(MAX(CAST(SUBSTRING(certificate_number FROM '([0-9]+)$') AS INT)), 0) + 1
    INTO next_seq
  FROM public.certificates
  WHERE certificate_number LIKE prefix || '%';

  RETURN prefix || LPAD(next_seq::TEXT, 3, '0');
END;
$$;

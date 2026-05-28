UPDATE public.publications
SET publication_number = NULL,
    certification_status = 'not_certified'
WHERE id = 'dd96df94-31e8-4b1c-860f-4c771d5d1f77'
  AND publication_number = 'KMG-MEM-2026-001'
  AND certification_status = 'pending'
  AND NOT EXISTS (
    SELECT 1
    FROM public.certificates c
    WHERE c.publication_id = public.publications.id
  );
UPDATE public.publications
SET certification_status = 'not_certified',
    publication_number = NULL
WHERE id = '2d32d22f-79c2-4d9c-afef-70bb188e4823'
  AND certification_status = 'pending'
  AND NOT EXISTS (SELECT 1 FROM public.certificates c WHERE c.publication_id = publications.id);
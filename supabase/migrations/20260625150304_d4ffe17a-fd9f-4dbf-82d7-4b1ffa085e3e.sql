
DROP POLICY IF EXISTS "Submitters can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Submitters can read own files" ON storage.objects;
DROP POLICY IF EXISTS "Submitters can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Admins can read all submission files" ON storage.objects;

CREATE POLICY "Submitters can upload to own folder"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Submitters can read own files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Submitters can delete own files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'submissions'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Admins can read all submission files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'submissions'
  AND public.has_role(auth.uid(), 'admin'::public.app_role)
);

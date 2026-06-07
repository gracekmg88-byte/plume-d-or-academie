
DO $$
DECLARE tbl record;
BEGIN
  FOR tbl IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r' AND n.nspname='public'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', tbl.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl.relname);
  END LOOP;
END $$;

-- Anon read access for public-facing tables
GRANT SELECT ON public.publications TO anon;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.comments TO anon;
GRANT INSERT ON public.contact_messages TO anon;
GRANT INSERT ON public.newsletter_subscribers TO anon;

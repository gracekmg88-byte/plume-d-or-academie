INSERT INTO public.site_settings (key, value, label, category)
VALUES ('library_layout', 'grid', 'Disposition de la bibliothèque', 'general')
ON CONFLICT (key) DO NOTHING;
-- Create a table for site settings including payment details
CREATE TABLE public.site_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  label TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Settings are viewable by everyone" 
ON public.site_settings 
FOR SELECT 
USING (true);

-- Only admins can update settings
CREATE POLICY "Admins can update settings" 
ON public.site_settings 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Only admins can insert settings
CREATE POLICY "Admins can insert settings" 
ON public.site_settings 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- Insert default payment settings
INSERT INTO public.site_settings (key, value, label, category) VALUES
  ('payment_mobile_number', '+243 998 102 000', 'Numéro Mobile Money', 'payment'),
  ('payment_mobile_name', 'Kot Gracia', 'Nom bénéficiaire Mobile Money', 'payment'),
  ('payment_bank_name', 'Equity BCDC', 'Nom de la banque', 'payment'),
  ('payment_bank_account', '500005286303929', 'Numéro de compte bancaire', 'payment'),
  ('payment_bank_beneficiary', 'KOT MUNON GRÂCE', 'Bénéficiaire bancaire', 'payment'),
  ('payment_whatsapp', '+243998102000', 'Numéro WhatsApp (sans espaces)', 'payment'),
  ('payment_amount', '5', 'Montant (USD)', 'payment');

-- Create trigger for updated_at
CREATE TRIGGER update_site_settings_updated_at
BEFORE UPDATE ON public.site_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
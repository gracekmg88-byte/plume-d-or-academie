-- Fix 1: Add RLS policy for users to view their own roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Fix 2: Restrict site_settings to admin only for payment-sensitive data
-- First, drop the existing permissive SELECT policy
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;

-- Create a more restrictive policy: only admins can view site_settings
CREATE POLICY "Only admins can view site settings"
ON public.site_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);

-- Also update the INSERT policy to be admin-only (if it exists with true)
DROP POLICY IF EXISTS "Admins can insert site settings" ON public.site_settings;
CREATE POLICY "Admins can insert site settings"
ON public.site_settings
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_roles.user_id = auth.uid() 
    AND user_roles.role = 'admin'
  )
);
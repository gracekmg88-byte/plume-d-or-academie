-- Premium : les formules (nom, durée, prix) sont lisibles par tous, y compris désactivées,
-- pour qu'un abonné voie toujours le nom de sa formule dans « Mon abonnement ».
-- Les prix ne sont pas des données sensibles ; l'application ne PROPOSE que les formules actives.
DROP POLICY IF EXISTS "Formules actives visibles" ON public.subscription_plans;
DROP POLICY IF EXISTS "Formules visibles par tous" ON public.subscription_plans;
CREATE POLICY "Formules visibles par tous" ON public.subscription_plans FOR SELECT
  TO anon, authenticated USING (true);

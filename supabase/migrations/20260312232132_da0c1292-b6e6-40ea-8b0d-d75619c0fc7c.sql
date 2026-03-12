
-- Restrict WooCommerce credential access to owner/admin only
DROP POLICY IF EXISTS "Company read" ON public.woocommerce_integrations;
DROP POLICY IF EXISTS "Company write" ON public.woocommerce_integrations;
DROP POLICY IF EXISTS "Company update" ON public.woocommerce_integrations;
DROP POLICY IF EXISTS "Company delete" ON public.woocommerce_integrations;

CREATE POLICY "Admins can read integrations" ON public.woocommerce_integrations
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    AND (user_has_role(company_id, 'owner') OR user_has_role(company_id, 'admin'))
  );

CREATE POLICY "Admins can create integrations" ON public.woocommerce_integrations
  AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    AND (user_has_role(company_id, 'owner') OR user_has_role(company_id, 'admin'))
  );

CREATE POLICY "Admins can update integrations" ON public.woocommerce_integrations
  AS PERMISSIVE FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    AND (user_has_role(company_id, 'owner') OR user_has_role(company_id, 'admin'))
  );

CREATE POLICY "Admins can delete integrations" ON public.woocommerce_integrations
  AS PERMISSIVE FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT get_user_company_ids(auth.uid()))
    AND (user_has_role(company_id, 'owner') OR user_has_role(company_id, 'admin'))
  );

-- Fix privilege escalation: admins should not be able to assign 'owner' role
DROP POLICY "Owners can insert memberships" ON public.user_companies;

CREATE POLICY "Admins can insert memberships"
  ON public.user_companies AS PERMISSIVE FOR INSERT TO authenticated
  WITH CHECK (
    CASE
      WHEN user_has_role(company_id, 'owner') THEN true
      WHEN user_has_role(company_id, 'admin') THEN role != 'owner'
      ELSE false
    END
  );
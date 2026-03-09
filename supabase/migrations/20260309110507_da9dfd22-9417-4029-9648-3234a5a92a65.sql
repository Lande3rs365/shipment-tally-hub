
-- 1) Fix profiles cross-company exposure: restrict SELECT to same-company users
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Users can view company profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT uc.user_id FROM public.user_companies uc
      WHERE uc.company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    )
  );

-- 2) Create a role-checking helper function
CREATE OR REPLACE FUNCTION public.user_has_role(_company_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = auth.uid()
      AND company_id = _company_id
      AND role = _role
  );
$$;

-- 3) Restrict company UPDATE to owners only
DROP POLICY IF EXISTS "Users can update their companies" ON public.companies;

CREATE POLICY "Owners can update their companies"
  ON public.companies FOR UPDATE TO authenticated
  USING (
    id IN (SELECT public.get_user_company_ids(auth.uid()))
    AND public.user_has_role(id, 'owner')
  );

-- 4) Restrict invitation management to owners/admins only
DROP POLICY IF EXISTS "Company members can create invitations" ON public.invitations;
CREATE POLICY "Owners can create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    AND (public.user_has_role(company_id, 'owner') OR public.user_has_role(company_id, 'admin'))
  );

DROP POLICY IF EXISTS "Company members can delete invitations" ON public.invitations;
CREATE POLICY "Owners can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    AND (public.user_has_role(company_id, 'owner') OR public.user_has_role(company_id, 'admin'))
  );

DROP POLICY IF EXISTS "Company members can update invitations" ON public.invitations;
CREATE POLICY "Owners can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.get_user_company_ids(auth.uid()))
    AND (public.user_has_role(company_id, 'owner') OR public.user_has_role(company_id, 'admin'))
  );

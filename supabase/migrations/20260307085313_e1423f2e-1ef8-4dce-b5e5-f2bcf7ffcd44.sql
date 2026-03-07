
-- 1. Create invitations table
CREATE TABLE public.invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  invitee_email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  invite_code text NOT NULL DEFAULT upper(substring(gen_random_uuid()::text from 1 for 8)),
  invited_by uuid NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, invitee_email)
);

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Owners/admins of the company can manage invitations
CREATE POLICY "Company members can view invitations"
  ON public.invitations FOR SELECT TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Company members can create invitations"
  ON public.invitations FOR INSERT TO authenticated
  WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Company members can delete invitations"
  ON public.invitations FOR DELETE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

CREATE POLICY "Company members can update invitations"
  ON public.invitations FOR UPDATE TO authenticated
  USING (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- 2. Create accept_invitation function (by token - email link)
CREATE OR REPLACE FUNCTION public.accept_invitation_by_token(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv record;
  _user_email text;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  SELECT * INTO _inv FROM public.invitations
    WHERE token = _token
      AND accepted_at IS NULL
      AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invitation not found, expired, or already used.');
  END IF;

  IF lower(_inv.invitee_email) != lower(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address.');
  END IF;

  -- Check if already a member
  IF EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND company_id = _inv.company_id) THEN
    UPDATE public.invitations SET accepted_at = now() WHERE id = _inv.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member of this company.', 'company_id', _inv.company_id);
  END IF;

  -- Create membership
  INSERT INTO public.user_companies (user_id, company_id, role)
  VALUES (auth.uid(), _inv.company_id, _inv.role);

  UPDATE public.invitations SET accepted_at = now() WHERE id = _inv.id;

  RETURN jsonb_build_object('success', true, 'message', 'Invitation accepted.', 'company_id', _inv.company_id);
END;
$$;

-- 3. Create accept_invitation function (by code - manual entry)
CREATE OR REPLACE FUNCTION public.accept_invitation_by_code(_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _inv record;
  _user_email text;
BEGIN
  SELECT email INTO _user_email FROM auth.users WHERE id = auth.uid();
  
  SELECT * INTO _inv FROM public.invitations
    WHERE upper(invite_code) = upper(_code)
      AND accepted_at IS NULL
      AND expires_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code.');
  END IF;

  IF lower(_inv.invitee_email) != lower(_user_email) THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation was sent to a different email address.');
  END IF;

  IF EXISTS (SELECT 1 FROM public.user_companies WHERE user_id = auth.uid() AND company_id = _inv.company_id) THEN
    UPDATE public.invitations SET accepted_at = now() WHERE id = _inv.id;
    RETURN jsonb_build_object('success', true, 'message', 'Already a member of this company.', 'company_id', _inv.company_id);
  END IF;

  INSERT INTO public.user_companies (user_id, company_id, role)
  VALUES (auth.uid(), _inv.company_id, _inv.role);

  UPDATE public.invitations SET accepted_at = now() WHERE id = _inv.id;

  RETURN jsonb_build_object('success', true, 'message', 'Invitation accepted.', 'company_id', _inv.company_id);
END;
$$;

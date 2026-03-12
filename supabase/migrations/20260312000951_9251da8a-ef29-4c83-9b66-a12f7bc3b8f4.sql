
-- Enforce seat limit at database level (FREE_MEMBER_LIMIT = 3 + purchased extra_seat add-ons)
CREATE OR REPLACE FUNCTION public.enforce_seat_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _base_limit integer := 3;
  _extra_seats integer;
  _current_members integer;
  _pending_invites integer;
  _total integer;
  _limit integer;
BEGIN
  -- Count purchased extra seats
  SELECT COALESCE(SUM(quantity), 0) INTO _extra_seats
  FROM public.purchased_addons
  WHERE company_id = NEW.company_id AND addon_type = 'extra_seat';

  _limit := _base_limit + _extra_seats;

  -- Count current members
  SELECT COUNT(*) INTO _current_members
  FROM public.user_companies
  WHERE company_id = NEW.company_id;

  -- Count pending (non-expired, non-accepted) invitations (excluding this new one)
  SELECT COUNT(*) INTO _pending_invites
  FROM public.invitations
  WHERE company_id = NEW.company_id
    AND accepted_at IS NULL
    AND expires_at > now();

  _total := _current_members + _pending_invites;

  IF _total >= _limit THEN
    RAISE EXCEPTION 'Seat limit reached. Your company has % of % seats used. Purchase additional seats to invite more members.', _total, _limit;
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to invitations table
CREATE TRIGGER trg_enforce_seat_limit
  BEFORE INSERT ON public.invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_seat_limit();

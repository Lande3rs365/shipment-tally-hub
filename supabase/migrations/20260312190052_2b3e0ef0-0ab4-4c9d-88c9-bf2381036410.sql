
-- 1. Add BEFORE INSERT trigger to reject inserts without a valid stripe_payment_id
CREATE OR REPLACE FUNCTION public.require_stripe_payment_id()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.stripe_payment_id IS NULL OR trim(NEW.stripe_payment_id) = '' THEN
    RAISE EXCEPTION 'stripe_payment_id is required. Addon purchases must go through the payment flow.';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_require_stripe_payment
  BEFORE INSERT ON public.purchased_addons
  FOR EACH ROW
  EXECUTE FUNCTION public.require_stripe_payment_id();

-- 2. Drop the permissive INSERT RLS policy so clients cannot insert directly
DROP POLICY IF EXISTS "Owners and admins can insert purchased addons" ON public.purchased_addons;

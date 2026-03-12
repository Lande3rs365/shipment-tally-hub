
-- Fix: Harden get_user_company_ids to prevent user enumeration
-- The function now ignores any passed parameter and always uses auth.uid()
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid DEFAULT auth.uid())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT company_id FROM public.user_companies WHERE user_id = auth.uid()
$function$;

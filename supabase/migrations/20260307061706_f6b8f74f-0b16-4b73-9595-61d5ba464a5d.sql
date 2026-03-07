
-- Fix: restrict companies INSERT to authenticated users only (the WITH CHECK (true) was flagged)
DROP POLICY "Users can insert companies" ON public.companies;
CREATE POLICY "Authenticated users can create companies" ON public.companies FOR INSERT TO authenticated WITH CHECK (true);

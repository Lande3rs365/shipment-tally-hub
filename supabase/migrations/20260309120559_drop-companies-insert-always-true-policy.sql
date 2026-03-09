-- Drop the always-true INSERT policy on the companies table.
--
-- This policy (WITH CHECK (true)) is unnecessary and was flagged by Supabase's
-- security advisor as an overly permissive RLS rule.
--
-- Company creation is handled exclusively via the create_company_with_owner()
-- SECURITY DEFINER RPC function, which runs as the function owner and bypasses
-- RLS entirely. No client code path performs a direct INSERT into companies.
-- Removing this policy has no functional impact on onboarding or any other flow.
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;

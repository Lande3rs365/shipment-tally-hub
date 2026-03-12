-- Increase invite code entropy from 8 hex chars (~4.3B combinations) to
-- 12 alphanumeric chars using an unambiguous character set (~1.2 quadrillion combinations).
-- Excludes visually similar characters: 0/O, 1/I to reduce user entry errors.

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE sql
AS $$
  SELECT string_agg(
    substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', (get_byte(gen_random_bytes(1)) % 32) + 1, 1),
    ''
  )
  FROM generate_series(1, 12);
$$;

ALTER TABLE public.invitations
  ALTER COLUMN invite_code SET DEFAULT public.generate_invite_code();

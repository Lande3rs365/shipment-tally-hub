
-- Add auto-sync interval column (0 = disabled)
ALTER TABLE public.woocommerce_integrations
  ADD COLUMN sync_interval_minutes integer NOT NULL DEFAULT 0;

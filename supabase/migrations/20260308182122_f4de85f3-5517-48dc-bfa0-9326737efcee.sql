ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS parent_product_id uuid REFERENCES public.products(id),
  ADD COLUMN IF NOT EXISTS row_type text NOT NULL DEFAULT 'standalone';
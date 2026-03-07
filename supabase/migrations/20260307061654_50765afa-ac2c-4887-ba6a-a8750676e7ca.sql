
-- ============================================
-- 1. COMPANIES
-- ============================================
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 2. USER_COMPANIES (multi-company mapping)
-- ============================================
CREATE TABLE public.user_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, company_id)
);
ALTER TABLE public.user_companies ENABLE ROW LEVEL SECURITY;

-- Security definer function to check company membership (avoids RLS recursion)
CREATE OR REPLACE FUNCTION public.user_belongs_to_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_companies
    WHERE user_id = _user_id AND company_id = _company_id
  )
$$;

-- Function to get all company IDs for a user
CREATE OR REPLACE FUNCTION public.get_user_company_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.user_companies WHERE user_id = _user_id
$$;

-- ============================================
-- 3. STOCK LOCATIONS
-- ============================================
CREATE TABLE public.stock_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text NOT NULL,
  location_type text NOT NULL DEFAULT 'warehouse',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, code)
);
ALTER TABLE public.stock_locations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. PRODUCTS
-- ============================================
CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku text NOT NULL,
  name text NOT NULL,
  description text,
  unit_cost numeric(10,2),
  sale_price numeric(10,2),
  weight_grams integer,
  reorder_point integer NOT NULL DEFAULT 0,
  reorder_qty integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, sku)
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. ORDERS
-- ============================================
CREATE TABLE public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  source text,
  status text NOT NULL DEFAULT 'pending',
  customer_name text,
  customer_email text,
  shipping_address text,
  total_amount numeric(10,2),
  currency text NOT NULL DEFAULT 'AUD',
  order_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, order_number)
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. ORDER ITEMS
-- ============================================
CREATE TABLE public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  sku text,
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric(10,2),
  line_total numeric(10,2)
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 7. SHIPMENTS (many per order)
-- ============================================
CREATE TABLE public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  shipment_number text,
  carrier text,
  tracking_number text,
  status text NOT NULL DEFAULT 'label_created',
  shipped_date timestamptz,
  delivered_date timestamptz,
  weight_grams integer,
  shipping_cost numeric(10,2),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, shipment_number)
);
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 8. SHIPMENT ITEMS
-- ============================================
CREATE TABLE public.shipment_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES public.shipments(id) ON DELETE CASCADE,
  order_item_id uuid REFERENCES public.order_items(id),
  product_id uuid REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1
);
ALTER TABLE public.shipment_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 9. MANUFACTURER MANIFESTS (inbound)
-- ============================================
CREATE TABLE public.manufacturer_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  manifest_number text,
  manufacturer_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expected_date timestamptz,
  received_date timestamptz,
  location_id uuid REFERENCES public.stock_locations(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, manifest_number)
);
ALTER TABLE public.manufacturer_manifests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 10. MANUFACTURER MANIFEST ITEMS
-- ============================================
CREATE TABLE public.manufacturer_manifest_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manifest_id uuid NOT NULL REFERENCES public.manufacturer_manifests(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id),
  sku text,
  expected_qty integer NOT NULL DEFAULT 0,
  received_qty integer NOT NULL DEFAULT 0,
  damaged_qty integer NOT NULL DEFAULT 0,
  short_qty integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending'
);
ALTER TABLE public.manufacturer_manifest_items ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 11. RETURNS (with stock outcome)
-- ============================================
CREATE TABLE public.returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.orders(id),
  return_number text,
  status text NOT NULL DEFAULT 'initiated',
  reason text,
  condition text,
  stock_outcome text,
  outcome_location_id uuid REFERENCES public.stock_locations(id),
  refund_amount numeric(10,2),
  initiated_date timestamptz,
  received_date timestamptz,
  resolved_date timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(company_id, return_number)
);
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 12. INVENTORY (current-state summary per SKU + location)
-- ============================================
CREATE TABLE public.inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  location_id uuid NOT NULL REFERENCES public.stock_locations(id) ON DELETE CASCADE,
  on_hand integer NOT NULL DEFAULT 0,
  available integer NOT NULL DEFAULT 0,
  reserved integer NOT NULL DEFAULT 0,
  allocated integer NOT NULL DEFAULT 0,
  damaged integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(product_id, location_id)
);
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 13. STOCK MOVEMENTS (immutable ledger)
-- ============================================
CREATE TABLE public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  sku text,
  direction text NOT NULL,
  movement_type text NOT NULL,
  quantity integer NOT NULL,
  from_location_id uuid REFERENCES public.stock_locations(id),
  to_location_id uuid REFERENCES public.stock_locations(id),
  linked_order_id uuid REFERENCES public.orders(id),
  linked_shipment_id uuid REFERENCES public.shipments(id),
  linked_return_id uuid REFERENCES public.returns(id),
  linked_manifest_id uuid REFERENCES public.manufacturer_manifests(id),
  reason_code text,
  notes text,
  performed_by uuid,
  timestamp timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 14. ORDER EVENTS
-- ============================================
CREATE TABLE public.order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  description text,
  metadata jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_events ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 15. EXCEPTIONS
-- ============================================
CREATE TABLE public.exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  exception_type text NOT NULL,
  severity text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  title text NOT NULL,
  description text,
  linked_order_id uuid REFERENCES public.orders(id),
  linked_shipment_id uuid REFERENCES public.shipments(id),
  linked_manifest_id uuid REFERENCES public.manufacturer_manifests(id),
  linked_return_id uuid REFERENCES public.returns(id),
  resolved_at timestamptz,
  resolved_by uuid,
  resolution_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exceptions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 16. DATA INTAKE LOGS
-- ============================================
CREATE TABLE public.data_intake_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text,
  file_path text,
  source_type text,
  status text NOT NULL DEFAULT 'uploading',
  total_rows integer,
  processed_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  error_details jsonb,
  uploaded_by uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.data_intake_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON public.orders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shipments_updated_at BEFORE UPDATE ON public.shipments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_manufacturer_manifests_updated_at BEFORE UPDATE ON public.manufacturer_manifests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_returns_updated_at BEFORE UPDATE ON public.returns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON public.inventory FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_exceptions_updated_at BEFORE UPDATE ON public.exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- RLS POLICIES (company-scoped via security definer)
-- ============================================

-- user_companies: users can see their own memberships
CREATE POLICY "Users can view own memberships" ON public.user_companies FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memberships" ON public.user_companies FOR INSERT WITH CHECK (auth.uid() = user_id);

-- companies: users can see companies they belong to
CREATE POLICY "Users can view their companies" ON public.companies FOR SELECT USING (id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Users can insert companies" ON public.companies FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update their companies" ON public.companies FOR UPDATE USING (id IN (SELECT public.get_user_company_ids(auth.uid())));

-- Macro: company-scoped read/write for all operational tables
CREATE POLICY "Company read" ON public.stock_locations FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.stock_locations FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.stock_locations FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.stock_locations FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.products FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.products FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.products FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.products FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.orders FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.orders FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.orders FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.orders FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.order_items FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.order_items FOR INSERT WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.order_items FOR UPDATE USING (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company delete" ON public.order_items FOR DELETE USING (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));

CREATE POLICY "Company read" ON public.shipments FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.shipments FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.shipments FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.shipments FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.shipment_items FOR SELECT USING (shipment_id IN (SELECT id FROM public.shipments WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.shipment_items FOR INSERT WITH CHECK (shipment_id IN (SELECT id FROM public.shipments WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.shipment_items FOR UPDATE USING (shipment_id IN (SELECT id FROM public.shipments WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company delete" ON public.shipment_items FOR DELETE USING (shipment_id IN (SELECT id FROM public.shipments WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));

CREATE POLICY "Company read" ON public.manufacturer_manifests FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.manufacturer_manifests FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.manufacturer_manifests FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.manufacturer_manifests FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.manufacturer_manifest_items FOR SELECT USING (manifest_id IN (SELECT id FROM public.manufacturer_manifests WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.manufacturer_manifest_items FOR INSERT WITH CHECK (manifest_id IN (SELECT id FROM public.manufacturer_manifests WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.manufacturer_manifest_items FOR UPDATE USING (manifest_id IN (SELECT id FROM public.manufacturer_manifests WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company delete" ON public.manufacturer_manifest_items FOR DELETE USING (manifest_id IN (SELECT id FROM public.manufacturer_manifests WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));

CREATE POLICY "Company read" ON public.returns FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.returns FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.returns FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.returns FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.inventory FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.inventory FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.inventory FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company delete" ON public.inventory FOR DELETE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.stock_movements FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.stock_movements FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.order_events FOR SELECT USING (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.order_events FOR INSERT WITH CHECK (order_id IN (SELECT id FROM public.orders WHERE company_id IN (SELECT public.get_user_company_ids(auth.uid()))));

CREATE POLICY "Company read" ON public.exceptions FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.exceptions FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.exceptions FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

CREATE POLICY "Company read" ON public.data_intake_logs FOR SELECT USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.data_intake_logs FOR INSERT WITH CHECK (company_id IN (SELECT public.get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.data_intake_logs FOR UPDATE USING (company_id IN (SELECT public.get_user_company_ids(auth.uid())));

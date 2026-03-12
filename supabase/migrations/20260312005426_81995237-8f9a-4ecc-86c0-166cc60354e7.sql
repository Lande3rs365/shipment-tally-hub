
-- =====================================================
-- Convert ALL RESTRICTIVE RLS policies to PERMISSIVE
-- and add invitee SELECT policy on invitations
-- =====================================================

-- ==================== companies ====================
DROP POLICY IF EXISTS "Authenticated users can create companies" ON public.companies;
DROP POLICY IF EXISTS "Owners can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Users can view their companies" ON public.companies;

CREATE POLICY "Authenticated users can create companies" ON public.companies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Owners can update their companies" ON public.companies AS PERMISSIVE FOR UPDATE TO authenticated USING ((id IN (SELECT get_user_company_ids(auth.uid()))) AND user_has_role(id, 'owner'::text));
CREATE POLICY "Users can view their companies" ON public.companies AS PERMISSIVE FOR SELECT TO authenticated USING (id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== data_intake_logs ====================
DROP POLICY IF EXISTS "Company read" ON public.data_intake_logs;
DROP POLICY IF EXISTS "Company update" ON public.data_intake_logs;
DROP POLICY IF EXISTS "Company write" ON public.data_intake_logs;

CREATE POLICY "Company read" ON public.data_intake_logs AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.data_intake_logs AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.data_intake_logs AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== exceptions ====================
DROP POLICY IF EXISTS "Company read" ON public.exceptions;
DROP POLICY IF EXISTS "Company update" ON public.exceptions;
DROP POLICY IF EXISTS "Company write" ON public.exceptions;

CREATE POLICY "Company read" ON public.exceptions AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.exceptions AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.exceptions AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== inventory ====================
DROP POLICY IF EXISTS "Company delete" ON public.inventory;
DROP POLICY IF EXISTS "Company read" ON public.inventory;
DROP POLICY IF EXISTS "Company update" ON public.inventory;
DROP POLICY IF EXISTS "Company write" ON public.inventory;

CREATE POLICY "Company delete" ON public.inventory AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.inventory AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.inventory AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.inventory AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== invitations ====================
DROP POLICY IF EXISTS "Admins can create invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can delete invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can update invitations" ON public.invitations;
DROP POLICY IF EXISTS "Admins can view invitations" ON public.invitations;

CREATE POLICY "Admins can create invitations" ON public.invitations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((company_id IN (SELECT get_user_company_ids(auth.uid()))) AND (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text)));
CREATE POLICY "Admins can delete invitations" ON public.invitations AS PERMISSIVE FOR DELETE TO authenticated USING ((company_id IN (SELECT get_user_company_ids(auth.uid()))) AND (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text)));
CREATE POLICY "Admins can update invitations" ON public.invitations AS PERMISSIVE FOR UPDATE TO authenticated USING ((company_id IN (SELECT get_user_company_ids(auth.uid()))) AND (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text)));
CREATE POLICY "Admins can view invitations" ON public.invitations AS PERMISSIVE FOR SELECT TO authenticated USING ((company_id IN (SELECT get_user_company_ids(auth.uid()))) AND (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text)));
CREATE POLICY "Invitees can view own invitations" ON public.invitations AS PERMISSIVE FOR SELECT TO authenticated USING (lower(invitee_email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())));

-- ==================== manufacturer_manifest_items ====================
DROP POLICY IF EXISTS "Company delete" ON public.manufacturer_manifest_items;
DROP POLICY IF EXISTS "Company read" ON public.manufacturer_manifest_items;
DROP POLICY IF EXISTS "Company update" ON public.manufacturer_manifest_items;
DROP POLICY IF EXISTS "Company write" ON public.manufacturer_manifest_items;

CREATE POLICY "Company delete" ON public.manufacturer_manifest_items AS PERMISSIVE FOR DELETE TO authenticated USING (manifest_id IN (SELECT id FROM manufacturer_manifests WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company read" ON public.manufacturer_manifest_items AS PERMISSIVE FOR SELECT TO authenticated USING (manifest_id IN (SELECT id FROM manufacturer_manifests WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.manufacturer_manifest_items AS PERMISSIVE FOR UPDATE TO authenticated USING (manifest_id IN (SELECT id FROM manufacturer_manifests WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.manufacturer_manifest_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (manifest_id IN (SELECT id FROM manufacturer_manifests WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));

-- ==================== manufacturer_manifests ====================
DROP POLICY IF EXISTS "Company delete" ON public.manufacturer_manifests;
DROP POLICY IF EXISTS "Company read" ON public.manufacturer_manifests;
DROP POLICY IF EXISTS "Company update" ON public.manufacturer_manifests;
DROP POLICY IF EXISTS "Company write" ON public.manufacturer_manifests;

CREATE POLICY "Company delete" ON public.manufacturer_manifests AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.manufacturer_manifests AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.manufacturer_manifests AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.manufacturer_manifests AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== order_events ====================
DROP POLICY IF EXISTS "Company read" ON public.order_events;
DROP POLICY IF EXISTS "Company write" ON public.order_events;

CREATE POLICY "Company read" ON public.order_events AS PERMISSIVE FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.order_events AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));

-- ==================== order_items ====================
DROP POLICY IF EXISTS "Company delete" ON public.order_items;
DROP POLICY IF EXISTS "Company read" ON public.order_items;
DROP POLICY IF EXISTS "Company update" ON public.order_items;
DROP POLICY IF EXISTS "Company write" ON public.order_items;

CREATE POLICY "Company delete" ON public.order_items AS PERMISSIVE FOR DELETE TO authenticated USING (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company read" ON public.order_items AS PERMISSIVE FOR SELECT TO authenticated USING (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.order_items AS PERMISSIVE FOR UPDATE TO authenticated USING (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.order_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (order_id IN (SELECT id FROM orders WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));

-- ==================== orders ====================
DROP POLICY IF EXISTS "Company delete" ON public.orders;
DROP POLICY IF EXISTS "Company read" ON public.orders;
DROP POLICY IF EXISTS "Company update" ON public.orders;
DROP POLICY IF EXISTS "Company write" ON public.orders;

CREATE POLICY "Company delete" ON public.orders AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.orders AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.orders AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.orders AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== products ====================
DROP POLICY IF EXISTS "Company delete" ON public.products;
DROP POLICY IF EXISTS "Company read" ON public.products;
DROP POLICY IF EXISTS "Company update" ON public.products;
DROP POLICY IF EXISTS "Company write" ON public.products;

CREATE POLICY "Company delete" ON public.products AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.products AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.products AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.products AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== profiles ====================
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view company profiles" ON public.profiles;

CREATE POLICY "Users can insert their own profile" ON public.profiles AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can view company profiles" ON public.profiles AS PERMISSIVE FOR SELECT TO authenticated USING ((user_id = auth.uid()) OR (user_id IN (SELECT uc.user_id FROM user_companies uc WHERE uc.company_id IN (SELECT get_user_company_ids(auth.uid())))));

-- ==================== purchased_addons ====================
DROP POLICY IF EXISTS "Company members can view purchased addons" ON public.purchased_addons;
DROP POLICY IF EXISTS "Owners and admins can insert purchased addons" ON public.purchased_addons;

CREATE POLICY "Company members can view purchased addons" ON public.purchased_addons AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Owners and admins can insert purchased addons" ON public.purchased_addons AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK ((company_id IN (SELECT get_user_company_ids(auth.uid()))) AND (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text)) AND (purchased_by = auth.uid()));

-- ==================== returns ====================
DROP POLICY IF EXISTS "Company delete" ON public.returns;
DROP POLICY IF EXISTS "Company read" ON public.returns;
DROP POLICY IF EXISTS "Company update" ON public.returns;
DROP POLICY IF EXISTS "Company write" ON public.returns;

CREATE POLICY "Company delete" ON public.returns AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.returns AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.returns AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.returns AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== shipment_items ====================
DROP POLICY IF EXISTS "Company delete" ON public.shipment_items;
DROP POLICY IF EXISTS "Company read" ON public.shipment_items;
DROP POLICY IF EXISTS "Company update" ON public.shipment_items;
DROP POLICY IF EXISTS "Company write" ON public.shipment_items;

CREATE POLICY "Company delete" ON public.shipment_items AS PERMISSIVE FOR DELETE TO authenticated USING (shipment_id IN (SELECT id FROM shipments WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company read" ON public.shipment_items AS PERMISSIVE FOR SELECT TO authenticated USING (shipment_id IN (SELECT id FROM shipments WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company update" ON public.shipment_items AS PERMISSIVE FOR UPDATE TO authenticated USING (shipment_id IN (SELECT id FROM shipments WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));
CREATE POLICY "Company write" ON public.shipment_items AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (shipment_id IN (SELECT id FROM shipments WHERE company_id IN (SELECT get_user_company_ids(auth.uid()))));

-- ==================== shipments ====================
DROP POLICY IF EXISTS "Company delete" ON public.shipments;
DROP POLICY IF EXISTS "Company read" ON public.shipments;
DROP POLICY IF EXISTS "Company update" ON public.shipments;
DROP POLICY IF EXISTS "Company write" ON public.shipments;

CREATE POLICY "Company delete" ON public.shipments AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.shipments AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.shipments AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.shipments AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== stock_locations ====================
DROP POLICY IF EXISTS "Company delete" ON public.stock_locations;
DROP POLICY IF EXISTS "Company read" ON public.stock_locations;
DROP POLICY IF EXISTS "Company update" ON public.stock_locations;
DROP POLICY IF EXISTS "Company write" ON public.stock_locations;

CREATE POLICY "Company delete" ON public.stock_locations AS PERMISSIVE FOR DELETE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company read" ON public.stock_locations AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company update" ON public.stock_locations AS PERMISSIVE FOR UPDATE TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.stock_locations AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== stock_movements ====================
DROP POLICY IF EXISTS "Company read" ON public.stock_movements;
DROP POLICY IF EXISTS "Company write" ON public.stock_movements;

CREATE POLICY "Company read" ON public.stock_movements AS PERMISSIVE FOR SELECT TO authenticated USING (company_id IN (SELECT get_user_company_ids(auth.uid())));
CREATE POLICY "Company write" ON public.stock_movements AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (company_id IN (SELECT get_user_company_ids(auth.uid())));

-- ==================== user_companies ====================
DROP POLICY IF EXISTS "Admins can insert memberships" ON public.user_companies;
DROP POLICY IF EXISTS "Owners can delete memberships" ON public.user_companies;
DROP POLICY IF EXISTS "Owners can update memberships" ON public.user_companies;
DROP POLICY IF EXISTS "Owners can view company memberships" ON public.user_companies;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.user_companies;

CREATE POLICY "Admins can insert memberships" ON public.user_companies AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (CASE WHEN user_has_role(company_id, 'owner'::text) THEN true WHEN user_has_role(company_id, 'admin'::text) THEN (role <> 'owner'::text) ELSE false END);
CREATE POLICY "Owners can delete memberships" ON public.user_companies AS PERMISSIVE FOR DELETE TO authenticated USING (user_has_role(company_id, 'owner'::text));
CREATE POLICY "Owners can update memberships" ON public.user_companies AS PERMISSIVE FOR UPDATE TO authenticated USING (user_has_role(company_id, 'owner'::text));
CREATE POLICY "Owners can view company memberships" ON public.user_companies AS PERMISSIVE FOR SELECT TO authenticated USING (user_has_role(company_id, 'owner'::text) OR user_has_role(company_id, 'admin'::text));
CREATE POLICY "Users can view own memberships" ON public.user_companies AS PERMISSIVE FOR SELECT TO authenticated USING (auth.uid() = user_id);

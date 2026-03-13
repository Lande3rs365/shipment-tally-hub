
-- Delete all companies except JFLOWERSCUES (96eddfc8-494d-48b7-8f5a-28fa90497ae2)
-- Correct dependency order

-- Leaf tables first
DELETE FROM order_events WHERE order_id IN (SELECT id FROM orders WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2');
DELETE FROM shipment_items WHERE shipment_id IN (SELECT id FROM shipments WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2');
DELETE FROM order_items WHERE order_id IN (SELECT id FROM orders WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2');
DELETE FROM manufacturer_manifest_items WHERE manifest_id IN (SELECT id FROM manufacturer_manifests WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2');

-- Stock movements reference orders, shipments, manifests, returns
DELETE FROM stock_movements WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Exceptions reference orders, shipments, manifests, returns
DELETE FROM exceptions WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Returns reference orders and products
DELETE FROM returns WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Shipments reference orders
DELETE FROM shipments WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Now orders are safe to delete
DELETE FROM orders WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Manifests
DELETE FROM manufacturer_manifests WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Inventory and locations
DELETE FROM inventory WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM stock_locations WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Products (referenced by returns, order_items, inventory — all deleted above)
DELETE FROM products WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Other company-scoped tables
DELETE FROM data_intake_logs WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM invitations WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM tawk_settings WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM woocommerce_integrations WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM shipstation_integrations WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM purchased_addons WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

-- Memberships and companies
DELETE FROM user_companies WHERE company_id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';
DELETE FROM companies WHERE id != '96eddfc8-494d-48b7-8f5a-28fa90497ae2';

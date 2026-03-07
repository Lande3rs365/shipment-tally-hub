
DO $$
DECLARE
  cid uuid := '9215d6c9-585d-4e87-a5b0-30209ef62c9a';
  loc_id uuid := '92aa5d03-9d1d-4df0-ad51-e1d73afb9170';
  p1 uuid; p2 uuid; p3 uuid; p4 uuid; p5 uuid; p6 uuid; p7 uuid; p8 uuid;
  o1 uuid; o2 uuid; o3 uuid; o4 uuid; o5 uuid; o6 uuid; o7 uuid; o8 uuid; o9 uuid; o10 uuid;
  s1 uuid; s4 uuid;
  m1 uuid; m2 uuid;
BEGIN
  SELECT id INTO p1 FROM products WHERE sku='JF-ROSE-001' AND company_id=cid LIMIT 1;
  SELECT id INTO p2 FROM products WHERE sku='JF-SILV-002' AND company_id=cid LIMIT 1;
  SELECT id INTO p3 FROM products WHERE sku='JF-PEARL-003' AND company_id=cid LIMIT 1;
  SELECT id INTO p4 FROM products WHERE sku='JF-ORCHID-004' AND company_id=cid LIMIT 1;
  SELECT id INTO p5 FROM products WHERE sku='JF-OPAL-005' AND company_id=cid LIMIT 1;
  SELECT id INTO p6 FROM products WHERE sku='JF-AMBER-006' AND company_id=cid LIMIT 1;
  SELECT id INTO p7 FROM products WHERE sku='JF-JADE-007' AND company_id=cid LIMIT 1;
  SELECT id INTO p8 FROM products WHERE sku='JF-TURQ-008' AND company_id=cid LIMIT 1;

  INSERT INTO orders (company_id, order_number, customer_name, customer_email, customer_phone, shipping_address, order_date, total_amount, status, woo_status, source) VALUES
    (cid, 'WC-20001', 'Emma Watson', 'emma@test.com', '0412345678', '12 Collins St, Melbourne VIC 3000', now()-interval '5 days', 179.90, 'shipped', 'completed', 'woocommerce'),
    (cid, 'WC-20002', 'Liam Chen', 'liam@test.com', '0423456789', '45 George St, Sydney NSW 2000', now()-interval '4 days', 49.95, 'shipped', 'completed', 'woocommerce'),
    (cid, 'WC-20003', 'Olivia Brown', 'olivia@test.com', '0434567890', '78 Queen St, Brisbane QLD 4000', now()-interval '3 days', 134.90, 'processing', 'processing', 'woocommerce'),
    (cid, 'WC-20004', 'Noah Smith', 'noah@test.com', '0445678901', '23 King William St, Adelaide SA 5000', now()-interval '2 days', 59.95, 'processing', 'processing', 'woocommerce'),
    (cid, 'WC-20005', 'Ava Johnson', 'ava@test.com', '0456789012', '56 Murray St, Perth WA 6000', now()-interval '2 days', 204.90, 'pending', 'on-hold', 'woocommerce'),
    (cid, 'WC-20006', 'William Lee', 'william@test.com', '0467890123', '89 Elizabeth St, Hobart TAS 7000', now()-interval '1 day', 84.95, 'pending', 'processing', 'woocommerce'),
    (cid, 'WC-20007', 'Sophia Davis', 'sophia@test.com', '0478901234', '34 Flinders St, Melbourne VIC 3000', now()-interval '1 day', 139.95, 'shipped', 'completed', 'woocommerce'),
    (cid, 'WC-20008', 'James Wilson', 'james@test.com', NULL, '67 Pitt St, Sydney NSW 2000', now()-interval '6 hours', 119.95, 'pending', 'on-hold', 'woocommerce'),
    (cid, 'WC-20009', 'Isabella Martin', 'isabella@test.com', '0490123456', '12 Adelaide St, Brisbane QLD 4000', now()-interval '3 hours', 64.95, 'pending', 'processing', 'manual'),
    (cid, 'WC-20010', 'Oliver Taylor', 'oliver@test.com', '0401234567', '90 Rundle Mall, Adelaide SA 5000', now()-interval '1 hour', 149.90, 'pending', 'processing', 'woocommerce');

  SELECT id INTO o1 FROM orders WHERE order_number='WC-20001' AND company_id=cid LIMIT 1;
  SELECT id INTO o2 FROM orders WHERE order_number='WC-20002' AND company_id=cid LIMIT 1;
  SELECT id INTO o3 FROM orders WHERE order_number='WC-20003' AND company_id=cid LIMIT 1;
  SELECT id INTO o4 FROM orders WHERE order_number='WC-20004' AND company_id=cid LIMIT 1;
  SELECT id INTO o5 FROM orders WHERE order_number='WC-20005' AND company_id=cid LIMIT 1;
  SELECT id INTO o6 FROM orders WHERE order_number='WC-20006' AND company_id=cid LIMIT 1;
  SELECT id INTO o7 FROM orders WHERE order_number='WC-20007' AND company_id=cid LIMIT 1;
  SELECT id INTO o8 FROM orders WHERE order_number='WC-20008' AND company_id=cid LIMIT 1;
  SELECT id INTO o9 FROM orders WHERE order_number='WC-20009' AND company_id=cid LIMIT 1;
  SELECT id INTO o10 FROM orders WHERE order_number='WC-20010' AND company_id=cid LIMIT 1;

  INSERT INTO order_items (order_id, product_id, sku, quantity, unit_price, line_total) VALUES
    (o1, p1, 'JF-ROSE-001', 2, 89.95, 179.90),
    (o2, p2, 'JF-SILV-002', 1, 49.95, 49.95),
    (o3, p3, 'JF-PEARL-003', 1, 74.95, 74.95),
    (o3, p4, 'JF-ORCHID-004', 1, 59.95, 59.95),
    (o4, p4, 'JF-ORCHID-004', 1, 59.95, 59.95),
    (o5, p5, 'JF-OPAL-005', 1, 119.95, 119.95),
    (o5, p6, 'JF-AMBER-006', 1, 84.95, 84.95),
    (o6, p6, 'JF-AMBER-006', 1, 84.95, 84.95),
    (o7, p7, 'JF-JADE-007', 1, 139.95, 139.95),
    (o8, p5, 'JF-OPAL-005', 1, 119.95, 119.95),
    (o9, p8, 'JF-TURQ-008', 1, 64.95, 64.95),
    (o10, p1, 'JF-ROSE-001', 1, 89.95, 89.95),
    (o10, p4, 'JF-ORCHID-004', 1, 59.95, 59.95);

  INSERT INTO shipments (company_id, order_id, shipment_number, carrier, tracking_number, status, shipped_date, delivered_date, shipping_cost, weight_grams) VALUES
    (cid, o1, 'SHP-20001', 'Australia Post', 'AP20001234AU', 'delivered', now()-interval '4 days', now()-interval '2 days', 12.50, 50),
    (cid, o2, 'SHP-20002', 'StarTrack', 'ST20002345AU', 'in_transit', now()-interval '3 days', NULL, 9.95, 18),
    (cid, o7, 'SHP-20003', 'Australia Post', 'AP20003456AU', 'delivered', now()-interval '12 hours', now()-interval '2 hours', 14.50, 45),
    (cid, o1, 'SHP-20004', 'Sendle', 'SE20004567AU', 'exception', now()-interval '3 days', NULL, 8.50, 25),
    (cid, o3, 'SHP-20005', 'Australia Post', 'AP20005678AU', 'label_created', NULL, NULL, 11.00, 27);

  SELECT id INTO s1 FROM shipments WHERE shipment_number='SHP-20001' AND company_id=cid LIMIT 1;
  SELECT id INTO s4 FROM shipments WHERE shipment_number='SHP-20004' AND company_id=cid LIMIT 1;

  INSERT INTO inventory (company_id, product_id, location_id, on_hand, available, reserved, allocated, damaged) VALUES
    (cid, p1, loc_id, 120, 105, 10, 5, 0),
    (cid, p2, loc_id, 85, 80, 5, 0, 0),
    (cid, p3, loc_id, 60, 55, 3, 2, 0),
    (cid, p4, loc_id, 45, 40, 3, 2, 0),
    (cid, p5, loc_id, 8, 5, 2, 1, 0),
    (cid, p6, loc_id, 30, 25, 3, 2, 0),
    (cid, p7, loc_id, 12, 10, 1, 1, 0),
    (cid, p8, loc_id, 55, 50, 3, 2, 0);

  INSERT INTO stock_movements (company_id, product_id, sku, quantity, direction, movement_type, to_location_id, linked_order_id, linked_shipment_id, notes) VALUES
    (cid, p1, 'JF-ROSE-001', 200, 'IN', 'purchase_receive', loc_id, NULL, NULL, 'Initial stock receive'),
    (cid, p2, 'JF-SILV-002', 150, 'IN', 'purchase_receive', loc_id, NULL, NULL, 'Initial stock receive'),
    (cid, p3, 'JF-PEARL-003', 100, 'IN', 'purchase_receive', loc_id, NULL, NULL, 'Initial stock receive'),
    (cid, p1, 'JF-ROSE-001', 2, 'OUT', 'order_fulfill', NULL, o1, s1, 'Shipped order WC-20001'),
    (cid, p2, 'JF-SILV-002', 1, 'OUT', 'order_fulfill', NULL, o2, NULL, 'Shipped order WC-20002'),
    (cid, p7, 'JF-JADE-007', 1, 'OUT', 'order_fulfill', NULL, o7, NULL, 'Shipped order WC-20007'),
    (cid, p5, 'JF-OPAL-005', 2, 'ADJUST', 'damage_write_off', NULL, NULL, NULL, 'Damaged in storage - write off');

  INSERT INTO exceptions (company_id, title, description, exception_type, severity, status, linked_order_id, linked_shipment_id) VALUES
    (cid, 'Short receipt - Rose Gold Pendants', 'Received 180 of 200 expected units', 'short_receipt', 'high', 'open', NULL, NULL),
    (cid, 'Damaged delivery - Order WC-20001', 'Customer reported damaged packaging', 'damaged_delivery', 'medium', 'open', o1, s4),
    (cid, 'Missing item - Order WC-20005', 'Customer claims Opal Stud Earrings missing', 'missing_item', 'high', 'open', o5, NULL),
    (cid, 'Carrier delay - StarTrack SHP-20002', 'Shipment stuck in transit for 3 days', 'carrier_delay', 'low', 'investigating', o2, NULL),
    (cid, 'Stock discrepancy - Pearl Earrings', 'Physical count 58 vs system 60', 'stock_discrepancy', 'medium', 'open', NULL, NULL),
    (cid, 'Wrong item shipped - WC-20004', 'Received Silver Bracelet instead of Orchid Ring', 'wrong_item', 'critical', 'open', o4, NULL);

  INSERT INTO manufacturer_manifests (company_id, manifest_number, manufacturer_name, status, request_date, shipment_date, tracking_number, eta, expected_date, location_id) VALUES
    (cid, 'MFG-2024-001', 'Pearl & Co Suppliers', 'partially_received', now()-interval '14 days', now()-interval '10 days', 'INTL20001234', now()+interval '1 day', now()-interval '1 day', loc_id),
    (cid, 'MFG-2024-002', 'Gem Source International', 'pending', now()-interval '3 days', NULL, NULL, now()+interval '7 days', now()+interval '7 days', loc_id);

  SELECT id INTO m1 FROM manufacturer_manifests WHERE manifest_number='MFG-2024-001' AND company_id=cid LIMIT 1;
  SELECT id INTO m2 FROM manufacturer_manifests WHERE manifest_number='MFG-2024-002' AND company_id=cid LIMIT 1;

  INSERT INTO manufacturer_manifest_items (manifest_id, product_id, sku, expected_qty, received_qty, damaged_qty, short_qty, status) VALUES
    (m1, p1, 'JF-ROSE-001', 100, 90, 2, 8, 'partial'),
    (m1, p3, 'JF-PEARL-003', 50, 50, 0, 0, 'received'),
    (m1, p5, 'JF-OPAL-005', 30, 0, 0, 30, 'pending'),
    (m2, p6, 'JF-AMBER-006', 60, 0, 0, 0, 'pending'),
    (m2, p8, 'JF-TURQ-008', 80, 0, 0, 0, 'pending');
END $$;

import { describe, it, expect } from "vitest";
import {
  parseWooCommerceCSV,
  parseShipmentCSV,
  detectCSVSource,
  detectCSVSourceFromText,
  type ParsedOrder,
  type ParsedShipment,
} from "@/lib/csvParsers";

// ─────────────────────────────────────────────
// detectCSVSource
// ─────────────────────────────────────────────
describe("detectCSVSource", () => {
  it("detects pirate_ship from headers", () => {
    const headers = ["tracking number", "tracking status", "recipient", "ship date", "carrier", "cost"];
    expect(detectCSVSource(headers)).toBe("pirate_ship");
  });

  it("detects woocommerce from headers", () => {
    const headers = ["order_id", "billing_first_name", "billing_email", "order_total", "shipping_address_1"];
    expect(detectCSVSource(headers)).toBe("woocommerce");
  });

  it("returns unknown for unrecognised headers", () => {
    const headers = ["foo", "bar", "baz"];
    expect(detectCSVSource(headers)).toBe("unknown");
  });

  it("is case-insensitive for pirate ship headers", () => {
    const headers = ["Tracking Number", "Tracking Status", "Recipient", "Ship Date", "Carrier", "Cost"];
    expect(detectCSVSource(headers)).toBe("pirate_ship");
  });

  it("requires at least 3 matching pirate ship headers", () => {
    const headers = ["tracking number", "tracking status"]; // only 2
    expect(detectCSVSource(headers)).toBe("unknown");
  });

  it("requires at least 3 matching woocommerce headers", () => {
    const headers = ["order_id", "billing_first_name"]; // only 2
    expect(detectCSVSource(headers)).toBe("unknown");
  });
});

describe("detectCSVSourceFromText", () => {
  it("detects pirate_ship from raw CSV text", () => {
    const csv = `Tracking Number,Tracking Status,Recipient,Ship Date,Carrier,Cost\n9400111899223450467890,Delivered,John Smith,2024-01-15,USPS,4.50`;
    expect(detectCSVSourceFromText(csv)).toBe("pirate_ship");
  });

  it("detects woocommerce from raw CSV text", () => {
    const csv = `order_id,billing_first_name,billing_email,order_total,shipping_address_1\n12345,Jane,jane@example.com,99.99,1 Main St`;
    expect(detectCSVSourceFromText(csv)).toBe("woocommerce");
  });

  it("returns unknown for empty CSV", () => {
    expect(detectCSVSourceFromText("")).toBe("unknown");
  });
});

// ─────────────────────────────────────────────
// parseWooCommerceCSV
// ─────────────────────────────────────────────
describe("parseWooCommerceCSV", () => {
  const minimalCSV = `order_id,order_date,status,billing_first_name,billing_last_name,billing_email,billing_phone,shipping_address_1,shipping_city,shipping_state,shipping_postcode,shipping_country,order_total,order_currency
12345,2024-01-15,processing,Jane,Smith,jane@example.com,0400000000,1 Main St,Sydney,NSW,2000,AU,99.99,AUD`;

  it("parses a minimal WooCommerce CSV row", () => {
    const result = parseWooCommerceCSV(minimalCSV);
    expect(result).toHaveLength(1);
    const order = result[0];
    expect(order.order_number).toBe("12345");
    expect(order.customer_name).toBe("Jane Smith");
    expect(order.customer_email).toBe("jane@example.com");
    expect(order.total_amount).toBe(99.99);
    expect(order.currency).toBe("AUD");
    expect(order.source).toBe("woocommerce");
  });

  it("normalises woo-prefixed status", () => {
    const csv = `order_id,status\n99999,wc-processing`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].woo_status).toBe("processing");
    expect(result[0].status).toBe("processing");
  });

  it("maps woo_status=completed to internal status=completed", () => {
    const csv = `order_id,status\n1,completed`;
    expect(parseWooCommerceCSV(csv)[0].status).toBe("completed");
  });

  it("maps woo_status=refunded to internal status=cancelled", () => {
    const csv = `order_id,status\n1,refunded`;
    expect(parseWooCommerceCSV(csv)[0].status).toBe("cancelled");
  });

  it("maps woo_status=on-hold to internal status=on-hold", () => {
    const csv = `order_id,status\n1,on-hold`;
    expect(parseWooCommerceCSV(csv)[0].status).toBe("on-hold");
  });

  it("filters out rows without an order_id", () => {
    const csv = `order_id,status\n,processing`;
    const result = parseWooCommerceCSV(csv);
    expect(result).toHaveLength(0);
  });

  it("builds shipping address from parts", () => {
    const csv = `order_id,shipping_address_1,shipping_city,shipping_state,shipping_postcode,shipping_country\n1,1 Main St,Sydney,NSW,2000,AU`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].shipping_address).toBe("1 Main St, Sydney, NSW, 2000, AU");
  });

  it("returns null shipping_address when all parts are empty", () => {
    const csv = `order_id,status\n1,processing`;
    expect(parseWooCommerceCSV(csv)[0].shipping_address).toBeNull();
  });

  it("handles multiple rows", () => {
    const csv = `order_id,status\n1,processing\n2,completed\n3,cancelled`;
    expect(parseWooCommerceCSV(csv)).toHaveLength(3);
  });

  it("parses line items in standard format", () => {
    const csv = `order_id,line_item_1\n1,"Cue Stick (SKU: CUE-001) x2 @$50.00 = $100.00"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items).toHaveLength(1);
    const li = result[0].line_items[0];
    expect(li.name).toBe("Cue Stick");
    expect(li.sku).toBe("CUE-001");
    expect(li.quantity).toBe(2);
  });

  it("parses pipe-delimited line items", () => {
    const csv = `order_id,line_item_1\n1,"Cue Stick | SKU: CUE-002 | Qty: 3 | Total: $75.00"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items[0].quantity).toBe(3);
    expect(result[0].line_items[0].sku).toBe("CUE-002");
  });

  it("handles empty CSV gracefully", () => {
    expect(parseWooCommerceCSV("")).toHaveLength(0);
  });

  it("handles CSV with only headers", () => {
    const csv = `order_id,status`;
    expect(parseWooCommerceCSV(csv)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// parseShipmentCSV
// ─────────────────────────────────────────────
describe("parseShipmentCSV", () => {
  const minimalCSV = `Order ID,Tracking Number,Tracking Status,Recipient,Email,Carrier,Ship Date,Cost,Weight (oz),Country
12345,9400111899223450467890,Delivered,John Smith,john@example.com,USPS,2024-01-20,4.50,12.5,US`;

  it("parses a minimal Pirate Ship CSV row", () => {
    const result = parseShipmentCSV(minimalCSV);
    expect(result).toHaveLength(1);
    const s = result[0];
    expect(s.order_number).toBe("12345");
    expect(s.tracking_number).toBe("9400111899223450467890");
    expect(s.carrier).toBe("USPS");
    expect(s.status).toBe("delivered");
    expect(s.customer_name).toBe("John Smith");
    expect(s.shipping_cost).toBe(4.5);
  });

  it("converts weight from oz to grams", () => {
    const result = parseShipmentCSV(minimalCSV);
    // 12.5 oz * 28.3495 = ~354g
    expect(result[0].weight_grams).toBeCloseTo(354, 0);
  });

  it("sets delivered_date when status is delivered", () => {
    const result = parseShipmentCSV(minimalCSV);
    expect(result[0].delivered_date).not.toBeNull();
    expect(result[0].shipped_date).not.toBeNull();
  });

  it("sets shipped_date to null for label_created status", () => {
    const csv = `Order ID,Tracking Number,Tracking Status,Ship Date\n1,TRACK123,New Label Created,2024-01-20`;
    const result = parseShipmentCSV(csv);
    expect(result[0].status).toBe("label_created");
    expect(result[0].shipped_date).toBeNull();
  });

  it("maps 'In Transit' tracking status to in_transit", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK123,In Transit`;
    expect(parseShipmentCSV(csv)[0].status).toBe("in_transit");
  });

  it("maps 'Arrived' tracking status to in_transit", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK123,Arrived at Facility`;
    expect(parseShipmentCSV(csv)[0].status).toBe("in_transit");
  });

  it("filters out rows without a tracking number", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,,Delivered`;
    expect(parseShipmentCSV(csv)).toHaveLength(0);
  });

  it("handles multiple rows", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK001,Delivered\n2,TRACK002,In Transit\n3,TRACK003,New Label`;
    expect(parseShipmentCSV(csv)).toHaveLength(3);
  });

  it("handles empty CSV gracefully", () => {
    expect(parseShipmentCSV("")).toHaveLength(0);
  });

  it("handles null weight gracefully", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK123,Delivered`;
    const result = parseShipmentCSV(csv);
    expect(result[0].weight_grams).toBeNull();
  });

  it("handles generic shipment CSV headers (non-Pirate Ship)", () => {
    const csv = `order_number,tracking_number,tracking_status,customer_name\n1,TRACK123,Delivered,Jane`;
    const result = parseShipmentCSV(csv);
    expect(result[0].order_number).toBe("1");
    expect(result[0].tracking_number).toBe("TRACK123");
  });
});

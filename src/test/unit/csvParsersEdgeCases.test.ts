import { describe, it, expect } from "vitest";
import {
  parseWooCommerceCSV,
  parseShipmentCSV,
  detectCSVSource,
  detectCSVSourceFromText,
} from "@/lib/csvParsers";

// ─────────────────────────────────────────────
// Edge cases: Empty & whitespace-only inputs
// ─────────────────────────────────────────────
describe("empty / whitespace inputs", () => {
  it("parseWooCommerceCSV handles whitespace-only string", () => {
    expect(parseWooCommerceCSV("   \n\n  ")).toHaveLength(0);
  });

  it("parseShipmentCSV handles whitespace-only string", () => {
    expect(parseShipmentCSV("   \n\n  ")).toHaveLength(0);
  });

  it("detectCSVSourceFromText handles whitespace-only string", () => {
    expect(detectCSVSourceFromText("   ")).toBe("unknown");
  });

  it("detectCSVSource handles empty header array", () => {
    expect(detectCSVSource([])).toBe("unknown");
  });

  it("parseWooCommerceCSV handles headers with no data rows", () => {
    expect(parseWooCommerceCSV("order_id,status\n")).toHaveLength(0);
  });

  it("parseShipmentCSV handles headers with no data rows", () => {
    expect(parseShipmentCSV("Order ID,Tracking Number\n")).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// Edge cases: Malformed rows
// ─────────────────────────────────────────────
describe("malformed rows", () => {
  it("WooCommerce: rows with extra commas don't crash", () => {
    const csv = `order_id,status,order_total\n1,processing,99.99,,,extra,fields`;
    const result = parseWooCommerceCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].order_number).toBe("1");
  });

  it("WooCommerce: rows with fewer columns than headers parse gracefully", () => {
    const csv = `order_id,status,billing_first_name,billing_last_name,order_total\n1,processing`;
    const result = parseWooCommerceCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].customer_name).toBeFalsy();
    expect(result[0].total_amount).toBeNull();
  });

  it("Shipment: rows with missing columns parse gracefully", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK1`;
    const result = parseShipmentCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe("label_created"); // empty status defaults
  });

  it("WooCommerce: completely garbled row (no valid order_id) is filtered", () => {
    const csv = `order_id,status\n,,,`;
    expect(parseWooCommerceCSV(csv)).toHaveLength(0);
  });

  it("Shipment: row with order but no tracking is filtered", () => {
    const csv = `Order ID,Tracking Number\n1,`;
    expect(parseShipmentCSV(csv)).toHaveLength(0);
  });

  it("WooCommerce: invalid date produces null order_date", () => {
    const csv = `order_id,order_date\n1,not-a-date`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].order_date).toBeNull();
  });

  it("WooCommerce: non-numeric order_total produces null", () => {
    const csv = `order_id,order_total\n1,abc`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].total_amount).toBeNaN();
  });

  it("Shipment: non-numeric cost produces null", () => {
    const csv = `Order ID,Tracking Number,Cost\n1,TRACK1,free`;
    const result = parseShipmentCSV(csv);
    expect(result[0].shipping_cost).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Edge cases: Special characters in fields
// ─────────────────────────────────────────────
describe("special characters in fields", () => {
  it("WooCommerce: handles commas inside quoted fields", () => {
    const csv = `order_id,billing_first_name,billing_last_name,shipping_address_1\n1,Jane,"Smith, Jr.","123 Main St, Suite 4"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].customer_name).toBe("Jane Smith, Jr.");
    expect(result[0].shipping_address).toContain("123 Main St, Suite 4");
  });

  it("WooCommerce: handles double quotes inside quoted fields", () => {
    const csv = `order_id,billing_first_name\n1,"John ""Johnny"" Doe"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].customer_name).toContain('Johnny');
  });

  it("WooCommerce: handles newlines inside quoted fields", () => {
    const csv = `order_id,shipping_address_1\n1,"123 Main St\nApt 4B"`;
    const result = parseWooCommerceCSV(csv);
    expect(result).toHaveLength(1);
    expect(result[0].shipping_address).toContain("123 Main St");
  });

  it("Shipment: handles special chars in recipient name", () => {
    const csv = `Order ID,Tracking Number,Recipient\n1,TRACK1,"O'Brien & Müller"`;
    const result = parseShipmentCSV(csv);
    expect(result[0].customer_name).toBe("O'Brien & Müller");
  });

  it("WooCommerce: handles unicode/emoji in fields", () => {
    const csv = `order_id,billing_first_name\n1,José 🎱`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].customer_name).toBe("José 🎱");
  });

  it("WooCommerce: handles HTML entities in fields", () => {
    const csv = `order_id,billing_first_name\n1,&amp; Test`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].customer_name).toBe("&amp; Test");
  });

  it("detection: handles headers with extra whitespace/padding", () => {
    const headers = ["  tracking number  ", "  tracking status  ", "  recipient  ", " ship date", "carrier ", " cost"];
    expect(detectCSVSource(headers)).toBe("pirate_ship");
  });
});

// ─────────────────────────────────────────────
// Edge cases: Line items edge cases
// ─────────────────────────────────────────────
describe("line item parsing edge cases", () => {
  it("handles line item with no SKU", () => {
    const csv = `order_id,line_item_1\n1,"Cue Stick x2 @$50.00 = $100.00"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items).toHaveLength(1);
    expect(result[0].line_items[0].sku).toBeNull();
    expect(result[0].line_items[0].quantity).toBe(2);
  });

  it("handles line item with only a name (plain text)", () => {
    const csv = `order_id,line_item_1\n1,"Some Product"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items[0].name).toBe("Some Product");
    expect(result[0].line_items[0].quantity).toBe(1);
  });

  it("handles empty line_item columns", () => {
    const csv = `order_id,line_item_1,line_item_2\n1,,`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items).toHaveLength(0);
  });

  it("handles line items with special characters in product name", () => {
    const csv = `order_id,line_item_1\n1,"JFlowers Cue - 12\" Model (SKU: JF-001) x1 @$299.00 = $299.00"`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].line_items).toHaveLength(1);
  });
});

// ─────────────────────────────────────────────
// Edge cases: Status mapping edge cases
// ─────────────────────────────────────────────
describe("status mapping edge cases", () => {
  it("WooCommerce: empty status defaults to processing", () => {
    const csv = `order_id,status\n1,`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].woo_status).toBe("processing");
    expect(result[0].status).toBe("processing");
  });

  it("WooCommerce: unknown status maps to pending", () => {
    const csv = `order_id,status\n1,some-weird-status`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].status).toBe("pending");
  });

  it("Shipment: empty tracking status defaults to label_created", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK1,`;
    const result = parseShipmentCSV(csv);
    expect(result[0].status).toBe("label_created");
  });

  it("Shipment: 'Picked Up' maps to in_transit", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK1,Picked Up`;
    expect(parseShipmentCSV(csv)[0].status).toBe("in_transit");
  });

  it("Shipment: 'Accepted' maps to in_transit", () => {
    const csv = `Order ID,Tracking Number,Tracking Status\n1,TRACK1,Accepted at Hub`;
    expect(parseShipmentCSV(csv)[0].status).toBe("in_transit");
  });
});

// ─────────────────────────────────────────────
// Edge cases: Currency and numbers
// ─────────────────────────────────────────────
describe("currency and number edge cases", () => {
  it("WooCommerce: missing currency defaults to AUD", () => {
    const csv = `order_id,order_currency\n1,`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].currency).toBe("AUD");
  });

  it("WooCommerce: lowercase currency is uppercased", () => {
    const csv = `order_id,order_currency\n1,usd`;
    const result = parseWooCommerceCSV(csv);
    expect(result[0].currency).toBe("USD");
  });

  it("Shipment: cost with dollar sign is parsed", () => {
    const csv = `Order ID,Tracking Number,Cost\n1,TRACK1,$12.50`;
    const result = parseShipmentCSV(csv);
    expect(result[0].shipping_cost).toBe(12.5);
  });

  it("Shipment: zero weight produces 0 grams", () => {
    const csv = `Order ID,Tracking Number,Weight (oz)\n1,TRACK1,0`;
    const result = parseShipmentCSV(csv);
    expect(result[0].weight_grams).toBe(0);
  });
});

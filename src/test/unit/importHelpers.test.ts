import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedOrder, ParsedShipment, ParsedMasterRow } from "@/lib/csvParsers";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

import { previewWooCommerceImport, previewShipmentImport, previewMasterImport } from "@/lib/importHelpers";
import { supabase } from "@/integrations/supabase/client";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const COMPANY_ID = "test-company-uuid";

function buildChain(data: any[] = []) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockResolvedValue({ data }),
    insert: vi.fn().mockResolvedValue({ data: [], error: null }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
  return chain;
}

const makeOrder = (order_number: string, woo_status = "processing"): ParsedOrder => ({
  order_number, order_date: null, status: woo_status, woo_status,
  customer_name: null, customer_email: null, customer_phone: null,
  shipping_address: null, total_amount: null, currency: "AUD",
  source: "woocommerce", line_items: [],
});

const makeShipment = (tracking_number: string | null, order_number = "1001"): ParsedShipment => ({
  order_number, tracking_number, carrier: "USPS", service: null,
  status: "in_transit", shipped_date: null, delivered_date: null,
  shipping_cost: null, weight_grams: null, order_date: null,
  woo_status: null, order_total: null, customer_name: null,
  customer_email: null, items: null, shipping_country: null,
});

const makeMasterRow = (order_number: string, woo_status = "processing", tracking_number: string | null = null): ParsedMasterRow => ({
  order_number, order_date: null, woo_status, status: woo_status,
  total_amount: 50, customer_name: "Test", items: null,
  shipping_country: "AU", tracking_number, carrier: null,
  service: null, tracking_status: "label_created",
  tracking_date: null, est_delivery: null, shipping_cost: null,
});

describe("previewWooCommerceImport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts all orders as new when none exist", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewWooCommerceImport([makeOrder("1001"), makeOrder("1002")], COMPANY_ID);
    expect(p.newOrders).toBe(2);
    expect(p.updatedOrders).toBe(0);
    expect(p.totalRows).toBe(2);
  });

  it("counts existing orders as updated", async () => {
    mockFrom.mockReturnValue(buildChain([{ order_number: "1001", id: "uuid-1" }]));
    const p = await previewWooCommerceImport([makeOrder("1001"), makeOrder("1002")], COMPANY_ID);
    expect(p.updatedOrders).toBe(1);
    expect(p.newOrders).toBe(1);
  });

  it("counts on-hold orders", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewWooCommerceImport([makeOrder("2001", "on-hold"), makeOrder("2002")], COMPANY_ID);
    expect(p.onHoldOrders).toBe(1);
  });

  it("returns zeros for empty input", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewWooCommerceImport([], COMPANY_ID);
    expect(p.newOrders).toBe(0);
    expect(p.totalRows).toBe(0);
  });

  it("always returns zero shipment counts", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewWooCommerceImport([makeOrder("1001")], COMPANY_ID);
    expect(p.newShipments).toBe(0);
    expect(p.updatedShipments).toBe(0);
  });
});

describe("previewShipmentImport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("counts all shipments as new when none exist", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewShipmentImport([makeShipment("TRACK001")], COMPANY_ID);
    expect(p.newShipments).toBe(1);
    expect(p.updatedShipments).toBe(0);
  });

  it("counts existing tracking numbers as updated", async () => {
    mockFrom.mockReturnValue(buildChain([{ tracking_number: "TRACK001", id: "uuid-t" }]));
    const p = await previewShipmentImport([makeShipment("TRACK001")], COMPANY_ID);
    expect(p.updatedShipments).toBe(1);
    expect(p.newShipments).toBe(0);
  });

  it("handles null tracking numbers", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewShipmentImport([makeShipment(null)], COMPANY_ID);
    expect(p.totalRows).toBe(1);
  });

  it("always returns zero order counts", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewShipmentImport([makeShipment("T1")], COMPANY_ID);
    expect(p.newOrders).toBe(0);
    expect(p.updatedOrders).toBe(0);
  });
});

describe("previewMasterImport", () => {
  beforeEach(() => vi.clearAllMocks());

  it("identifies new vs updated orders", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      return call === 1
        ? buildChain([{ order_number: "1001", id: "uuid-1" }])
        : buildChain([]);
    });
    const p = await previewMasterImport([makeMasterRow("1001"), makeMasterRow("1002")], COMPANY_ID);
    expect(p.updatedOrders).toBe(1);
    expect(p.newOrders).toBe(1);
    expect(p.totalRows).toBe(2);
  });

  it("counts on-hold rows", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewMasterImport([makeMasterRow("3001", "on-hold")], COMPANY_ID);
    expect(p.onHoldOrders).toBe(1);
  });

  it("handles empty input", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const p = await previewMasterImport([], COMPANY_ID);
    expect(p.totalRows).toBe(0);
  });

  it("counts new and updated shipments by tracking number", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call++;
      if (call === 1) return buildChain([]); // no existing orders
      return buildChain([{ tracking_number: "T001", id: "shp-1" }]); // T001 exists
    });
    const rows = [makeMasterRow("1001", "processing", "T001"), makeMasterRow("1002", "processing", "T002")];
    const p = await previewMasterImport(rows, COMPANY_ID);
    expect(p.updatedShipments).toBe(1);
    expect(p.newShipments).toBe(1);
  });
});

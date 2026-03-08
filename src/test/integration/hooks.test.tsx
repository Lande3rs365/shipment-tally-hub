import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn() },
}));

vi.mock("@/contexts/CompanyContext", () => ({
  useCompany: () => ({ currentCompany: { id: "company-test-uuid", name: "Test Co", code: "TEST" } }),
}));

import {
  useOrders, useShipments, useReturns, useExceptions,
  useProducts, useStockLocations, useDataIntakeLogs, useInventory,
} from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;

function buildChain(data: any[], error: any = null) {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({ data, error }),
    in: vi.fn().mockResolvedValue({ data, error }),
  };
  // make chain thenable so await supabase.from(...).select(...).eq(...) works
  chain.then = (resolve: any) => Promise.resolve({ data, error }).then(resolve);
  return chain;
}

function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: qc }, children);
}

describe("useOrders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns orders from Supabase", async () => {
    const mockOrders = [
      { id: "ord-1", order_number: "1001", status: "processing", order_items: [] },
      { id: "ord-2", order_number: "1002", status: "completed", order_items: [] },
    ];
    mockFrom.mockReturnValue(buildChain(mockOrders));
    const { result } = renderHook(() => useOrders(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data?.[0].order_number).toBe("1001");
  });

  it("handles empty orders", async () => {
    mockFrom.mockReturnValue(buildChain([]));
    const { result } = renderHook(() => useOrders(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(0);
  });

  it("surfaces Supabase errors", async () => {
    mockFrom.mockReturnValue(buildChain([], { message: "Permission denied" }));
    const { result } = renderHook(() => useOrders(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useShipments", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns shipments with joined order data", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "shp-1", tracking_number: "TRACK001", status: "delivered", orders: { order_number: "1001", customer_name: "Alice" } },
    ]));
    const { result } = renderHook(() => useShipments(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].tracking_number).toBe("TRACK001");
  });
});

describe("useExceptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns exceptions", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "exc-1", exception_type: "on_hold", status: "open", severity: "medium" },
    ]));
    const { result } = renderHook(() => useExceptions(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].exception_type).toBe("on_hold");
  });
});

describe("useProducts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns products", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "prod-1", sku: "CUE-001", name: "Cue Stick", is_active: true },
    ]));
    const { result } = renderHook(() => useProducts(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].sku).toBe("CUE-001");
  });
});

describe("useStockLocations", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stock locations", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "loc-1", name: "Warehouse A", code: "WH-A", is_active: true },
    ]));
    const { result } = renderHook(() => useStockLocations(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].code).toBe("WH-A");
  });
});

describe("useInventory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns inventory with relations", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "inv-1", on_hand: 10, products: { sku: "CUE-001", name: "Cue Stick", reorder_point: 2 }, stock_locations: { name: "WH-A", code: "WH-A" } },
    ]));
    const { result } = renderHook(() => useInventory(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].on_hand).toBe(10);
  });
});

describe("useReturns", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns returns with order numbers", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "ret-1", status: "pending", orders: { order_number: "1001" } },
    ]));
    const { result } = renderHook(() => useReturns(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].status).toBe("pending");
  });
});

describe("useDataIntakeLogs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns data intake logs", async () => {
    mockFrom.mockReturnValue(buildChain([
      { id: "log-1", file_name: "orders.csv", status: "completed", processed_rows: 100 },
    ]));
    const { result } = renderHook(() => useDataIntakeLogs(), { wrapper: makeWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].file_name).toBe("orders.csv");
  });
});

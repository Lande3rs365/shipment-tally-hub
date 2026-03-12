import { supabase } from "@/integrations/supabase/client";
import type { ParsedOrder } from "./csvParsers";

// ── Types ──

interface WooLineItem {
  sku: string;
  quantity: number;
  price: string;
  total: string;
}

interface WooOrder {
  id: number;
  number: string;
  status: string;
  date_created: string;
  total: string;
  currency: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
  };
  shipping: {
    first_name: string;
    last_name: string;
    address_1: string;
    address_2: string;
    city: string;
    state: string;
    postcode: string;
    country: string;
  };
  line_items: WooLineItem[];
}

// ── Status mapping ──

const WOO_STATUS_MAP: Record<string, string> = {
  processing: "processing",
  "on-hold": "processing",
  pending: "pending",
  completed: "completed",
  cancelled: "cancelled",
  refunded: "cancelled",
  failed: "cancelled",
};

// ── Transform ──

export function transformWooOrder(woo: WooOrder): ParsedOrder {
  const shipping = woo.shipping;
  const addressParts = [
    [shipping.first_name, shipping.last_name].filter(Boolean).join(" "),
    shipping.address_1,
    shipping.address_2,
    [shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(", "),
    shipping.country,
  ].filter(Boolean);

  return {
    order_number: String(woo.number),
    order_date: woo.date_created || null,
    status: WOO_STATUS_MAP[woo.status] || "pending",
    woo_status: woo.status,
    customer_name: [woo.billing.first_name, woo.billing.last_name].filter(Boolean).join(" ") || null,
    customer_email: woo.billing.email || null,
    customer_phone: woo.billing.phone || null,
    shipping_address: addressParts.join(", ") || null,
    total_amount: parseFloat(woo.total) || null,
    currency: woo.currency || "AUD",
    source: "woocommerce_api",
    line_items: (woo.line_items || []).map((li: any) => ({
      sku: li.sku || "",
      name: li.name || li.sku || "Unknown",
      quantity: li.quantity || 1,
      unit_price: parseFloat(li.price) || null,
      line_total: parseFloat(li.total) || null,
    })),
  };
}

// ── Edge function calls ──

async function callWooProxy(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("woo-proxy", {
    body: payload,
  });
  if (error) throw new Error(error.message || "Edge function error");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function testWooConnection(companyId: string): Promise<{ success: boolean }> {
  return callWooProxy({ company_id: companyId, action: "test" });
}

export interface FetchOrdersResult {
  orders: ParsedOrder[];
  totalPages: number;
  totalOrders: number;
  page: number;
}

export async function fetchWooOrdersPage(
  companyId: string,
  page: number,
  after?: string,
): Promise<FetchOrdersResult> {
  const data = await callWooProxy({
    company_id: companyId,
    action: "fetch_orders",
    page,
    per_page: 100,
    ...(after ? { after } : {}),
  });

  return {
    orders: (data.orders || []).map(transformWooOrder),
    totalPages: data.total_pages || 1,
    totalOrders: data.total_orders || 0,
    page: data.page || page,
  };
}

/** Fetch all orders from WooCommerce, paginating automatically */
export async function fetchAllWooOrders(
  companyId: string,
  after?: string,
  onProgress?: (fetched: number, total: number) => void,
): Promise<ParsedOrder[]> {
  const allOrders: ParsedOrder[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const result = await fetchWooOrdersPage(companyId, page, after);
    allOrders.push(...result.orders);
    totalPages = result.totalPages;
    onProgress?.(allOrders.length, result.totalOrders);
    page++;
  }

  return allOrders;
}

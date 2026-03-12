/**
 * WooCommerce REST API v3 client
 *
 * Makes direct browser → WooCommerce store requests using HTTP Basic Auth
 * (consumer key + consumer secret).
 *
 * ⚠️  CORS requirement
 * WooCommerce does not enable CORS headers by default.  For this client to
 * work from the browser you must allow cross-origin requests on the store:
 *
 *   Option A — add to your theme's functions.php:
 *     add_filter('rest_pre_serve_request', function($served, $result, $request) {
 *       header('Access-Control-Allow-Origin: *');
 *       header('Access-Control-Allow-Methods: GET, OPTIONS');
 *       header('Access-Control-Allow-Headers: Authorization, Content-Type');
 *       return $served;
 *     }, 10, 3);
 *
 *   Option B — install the "WP REST API - CORS" plugin from the WordPress plugin
 *     repository and enable it.
 *
 * If CORS cannot be configured on the store, use a Supabase Edge Function as a
 * proxy instead (create a function that makes server-side requests).
 */

import type { ParsedOrder, ParsedLineItem } from "./csvParsers";

// ── Types ──────────────────────────────────────────────────────────────────

export interface WooLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  sku: string;
  price: string;
  total: string;
}

export interface WooBilling {
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WooShipping {
  address_1: string;
  address_2: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
}

export interface WooOrder {
  id: number;
  number: string;
  date_created: string;
  status: string;
  currency: string;
  total: string;
  billing: WooBilling;
  shipping: WooShipping;
  line_items: WooLineItem[];
}

export interface WooConnectionConfig {
  storeUrl: string;
  consumerKey: string;
  consumerSecret: string;
}

export interface WooFetchOptions {
  /** Only fetch orders created after this ISO date string */
  after?: string;
  /** WooCommerce order statuses to include; omit for all */
  statuses?: string[];
  /** Max pages to fetch (safety cap). Defaults to 100. */
  maxPages?: number;
}

export interface WooFetchResult {
  orders: ParsedOrder[];
  totalFetched: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function buildBasicAuth(consumerKey: string, consumerSecret: string): string {
  return "Basic " + btoa(`${consumerKey}:${consumerSecret}`);
}

function normalizeStoreUrl(raw: string): string {
  return raw.replace(/\/+$/, "");
}

function mapWooStatus(status: string): string {
  const map: Record<string, string> = {
    processing: "processing",
    "on-hold": "on-hold",
    completed: "completed",
    cancelled: "cancelled",
    refunded: "cancelled",
    failed: "cancelled",
    pending: "pending",
    trash: "cancelled",
  };
  const normalized = status.toLowerCase().replace(/^wc-/, "");
  return map[normalized] || "pending";
}

function buildShippingAddress(s: WooShipping): string | null {
  const parts = [s.address_1, s.address_2, s.city, s.state, s.postcode, s.country].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function transformLineItems(items: WooLineItem[]): ParsedLineItem[] {
  return items.map((item) => ({
    sku: item.sku || null,
    name: item.name,
    quantity: item.quantity,
    unit_price: item.price ? parseFloat(item.price) : null,
    line_total: item.total ? parseFloat(item.total) : null,
  }));
}

export function transformWooOrder(order: WooOrder): ParsedOrder {
  const wooStatus = order.status.toLowerCase().replace(/^wc-/, "");
  return {
    order_number: order.number || String(order.id),
    order_date: order.date_created || null,
    status: mapWooStatus(wooStatus),
    woo_status: wooStatus,
    customer_name: [order.billing.first_name, order.billing.last_name].filter(Boolean).join(" ") || null,
    customer_email: order.billing.email || null,
    customer_phone: order.billing.phone || null,
    shipping_address: buildShippingAddress(order.shipping),
    total_amount: order.total ? parseFloat(order.total) : null,
    currency: (order.currency || "AUD").toUpperCase(),
    source: "woocommerce",
    line_items: transformLineItems(order.line_items || []),
  };
}

// ── API client ─────────────────────────────────────────────────────────────

const WOO_PAGE_SIZE = 100; // WooCommerce max per_page is 100

/**
 * Fetch a single page of WooCommerce orders.
 * Throws on non-2xx HTTP status or network failure.
 */
async function fetchOrderPage(
  config: WooConnectionConfig,
  page: number,
  options: WooFetchOptions,
): Promise<{ orders: WooOrder[]; totalPages: number }> {
  const base = normalizeStoreUrl(config.storeUrl);
  const url = new URL(`${base}/wp-json/wc/v3/orders`);
  url.searchParams.set("per_page", String(WOO_PAGE_SIZE));
  url.searchParams.set("page", String(page));
  if (options.after) url.searchParams.set("after", options.after);
  if (options.statuses && options.statuses.length > 0) {
    url.searchParams.set("status", options.statuses.join(","));
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: buildBasicAuth(config.consumerKey, config.consumerSecret),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.message || body?.code || "";
    } catch {
      // ignore parse errors
    }
    throw new Error(
      `WooCommerce API error ${response.status}${detail ? `: ${detail}` : ""}`,
    );
  }

  const totalPages = parseInt(response.headers.get("X-WP-TotalPages") || "1", 10);
  const orders: WooOrder[] = await response.json();
  return { orders, totalPages };
}

/**
 * Test that credentials are valid by fetching a single order (page 1, per_page 1).
 * Returns true on success, throws on failure.
 */
export async function testWooConnection(config: WooConnectionConfig): Promise<true> {
  const base = normalizeStoreUrl(config.storeUrl);
  const url = new URL(`${base}/wp-json/wc/v3/orders`);
  url.searchParams.set("per_page", "1");
  url.searchParams.set("page", "1");

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      Authorization: buildBasicAuth(config.consumerKey, config.consumerSecret),
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = body?.message || body?.code || "";
    } catch {
      // ignore
    }
    throw new Error(
      `Connection failed (HTTP ${response.status})${detail ? `: ${detail}` : ""}`,
    );
  }

  return true;
}

/**
 * Fetch ALL orders from a WooCommerce store, paginating automatically.
 * Returns parsed orders ready to pass into importWooCommerceOrders().
 */
export async function fetchAllWooOrders(
  config: WooConnectionConfig,
  options: WooFetchOptions = {},
): Promise<WooFetchResult> {
  const maxPages = options.maxPages ?? 100;
  const allOrders: ParsedOrder[] = [];
  let page = 1;

  while (page <= maxPages) {
    const { orders: raw, totalPages } = await fetchOrderPage(config, page, options);
    for (const order of raw) {
      allOrders.push(transformWooOrder(order));
    }
    if (page >= totalPages || raw.length < WOO_PAGE_SIZE) break;
    page++;
  }

  return { orders: allOrders, totalFetched: allOrders.length };
}

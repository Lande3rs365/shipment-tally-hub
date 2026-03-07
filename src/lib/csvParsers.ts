import Papa from "papaparse";

export interface ParsedOrder {
  order_number: string;
  order_date: string | null;
  status: string;
  woo_status: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  shipping_address: string | null;
  total_amount: number | null;
  currency: string;
  source: string;
  line_items: ParsedLineItem[];
}

export interface ParsedLineItem {
  sku: string | null;
  name: string;
  quantity: number;
  unit_price: number | null;
  line_total: number | null;
}

function parseLineItem(raw: string): ParsedLineItem | null {
  if (!raw || !raw.trim()) return null;
  // Typical WooCommerce line item format varies, but common patterns:
  // "Product Name (SKU: ABC123) x 2 @ $10.00 = $20.00"
  // "Product Name | SKU: ABC123 | Qty: 2 | Total: $20.00"
  // Or just: "Product Name x2"
  // We'll try multiple patterns

  const trimmed = raw.trim();

  // Pattern: "name (SKU: xxx) x qty @ price = total"
  let match = trimmed.match(/^(.+?)\s*(?:\((?:SKU:\s*)?([^)]+)\))?\s*[x×]\s*(\d+)\s*(?:@\s*\$?([\d.]+))?\s*(?:=\s*\$?([\d.]+))?$/i);
  if (match) {
    return {
      name: match[1].trim(),
      sku: match[2]?.trim() || null,
      quantity: parseInt(match[3]) || 1,
      unit_price: match[4] ? parseFloat(match[4]) : null,
      line_total: match[5] ? parseFloat(match[5]) : null,
    };
  }

  // Pattern: pipe-delimited "name | SKU: xxx | Qty: 2 | Total: $20"
  if (trimmed.includes("|")) {
    const parts = trimmed.split("|").map(p => p.trim());
    const name = parts[0] || trimmed;
    let sku: string | null = null;
    let qty = 1;
    let total: number | null = null;

    for (const part of parts.slice(1)) {
      const skuMatch = part.match(/SKU:\s*(.+)/i);
      if (skuMatch) sku = skuMatch[1].trim();
      const qtyMatch = part.match(/Qty:\s*(\d+)/i);
      if (qtyMatch) qty = parseInt(qtyMatch[1]);
      const totalMatch = part.match(/Total:\s*\$?([\d.]+)/i);
      if (totalMatch) total = parseFloat(totalMatch[1]);
    }

    return { name, sku, quantity: qty, unit_price: total && qty ? total / qty : null, line_total: total };
  }

  // Pattern: simple "name x qty"
  const simpleMatch = trimmed.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (simpleMatch) {
    return {
      name: simpleMatch[1].trim(),
      sku: null,
      quantity: parseInt(simpleMatch[2]) || 1,
      unit_price: null,
      line_total: null,
    };
  }

  // Fallback: just the name
  return { name: trimmed, sku: null, quantity: 1, unit_price: null, line_total: null };
}

function buildShippingAddress(row: Record<string, string>): string | null {
  const parts = [
    row.shipping_address_1,
    row.shipping_address_2,
    row.shipping_city,
    row.shipping_state,
    row.shipping_postcode,
    row.shipping_country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeStatus(status: string): string {
  // WooCommerce statuses: processing, on-hold, completed, cancelled, refunded, failed, pending, trash
  const s = status.toLowerCase().replace(/^wc-/, "").trim();
  return s || "processing";
}

function mapToInternalStatus(wooStatus: string): string {
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
  return map[wooStatus] || "pending";
}

export function parseWooCommerceCSV(csvText: string): ParsedOrder[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });

  if (result.errors.length > 0) {
    console.warn("CSV parse warnings:", result.errors);
  }

  return result.data.map((row) => {
    const wooStatus = normalizeStatus(row.status || "");
    const lineItems: ParsedLineItem[] = [];

    // Parse line_item_1 through line_item_23
    for (let i = 1; i <= 23; i++) {
      const raw = row[`line_item_${i}`];
      const item = parseLineItem(raw || "");
      if (item) lineItems.push(item);
    }

    return {
      order_number: (row.order_id || "").trim(),
      order_date: row.order_date ? new Date(row.order_date).toISOString() : null,
      status: mapToInternalStatus(wooStatus),
      woo_status: wooStatus,
      customer_name: [row.billing_first_name, row.billing_last_name].filter(Boolean).join(" ") || null,
      customer_email: (row.billing_email || row.customer_email || "").trim() || null,
      customer_phone: (row.billing_phone || "").trim() || null,
      shipping_address: buildShippingAddress(row),
      total_amount: row.order_total ? parseFloat(row.order_total) : null,
      currency: (row.order_currency || "AUD").trim().toUpperCase(),
      source: "woocommerce",
      line_items: lineItems,
    };
  }).filter(o => o.order_number);
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

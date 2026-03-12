import Papa from "papaparse";
import * as XLSX from "xlsx";

// ── xlsx security mitigations ──
// GHSA-4r6h-8v6p-xvw6: Prototype Pollution — sanitize all keys returned by
//   sheet_to_json so __proto__ / constructor / prototype can never be used as
//   property names and pollute the Object prototype.
// GHSA-5pgg-2g8v-p4x9: ReDoS — cap the input buffer size so a crafted file
//   cannot trigger catastrophic backtracking in the xlsx regex engine.

const XLSX_MAX_BYTES = 20 * 1024 * 1024; // 20 MB hard cap

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function sanitizeRow(row: Record<string, any>): Record<string, any> {
  const safe: Record<string, any> = Object.create(null);
  for (const key of Object.keys(row)) {
    if (!DANGEROUS_KEYS.has(key)) {
      safe[key] = row[key];
    }
  }
  return safe;
}

function sanitizeRows(rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map(sanitizeRow);
}

function assertXlsxSize(data: ArrayBuffer): void {
  if (data.byteLength > XLSX_MAX_BYTES) {
    throw new Error(`File too large (${(data.byteLength / 1024 / 1024).toFixed(1)} MB). Maximum allowed size is 20 MB.`);
  }
}

// ── Shared Types ──

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

export interface ParsedShipment {
  order_number: string;
  tracking_number: string | null;
  carrier: string | null;
  service: string | null;
  status: string;
  carrier_status_detail: string | null;
  shipped_date: string | null;
  delivered_date: string | null;
  shipping_cost: number | null;
  weight_grams: number | null;
  order_date: string | null;
  woo_status: string | null;
  order_total: number | null;
  customer_name: string | null;
  customer_email: string | null;
  items: string | null;
  shipping_country: string | null;
}

/** Combined row from master XLSX — has both order + shipment data */
export interface ParsedMasterRow {
  order_number: string;
  order_date: string | null;
  woo_status: string;
  status: string;
  total_amount: number | null;
  customer_name: string | null;
  items: string | null;
  shipping_country: string | null;
  tracking_number: string | null;
  carrier: string | null;
  service: string | null;
  tracking_status: string;
  tracking_date: string | null;
  est_delivery: string | null;
  shipping_cost: number | null;
}

// ── Helpers ──

function parseLineItem(raw: string): ParsedLineItem | null {
  if (!raw || !raw.trim()) return null;
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

  // Pipe-delimited
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

  // Simple "name x qty"
  const simpleMatch = trimmed.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
  if (simpleMatch) {
    return { name: simpleMatch[1].trim(), sku: null, quantity: parseInt(simpleMatch[2]) || 1, unit_price: null, line_total: null };
  }

  return { name: trimmed, sku: null, quantity: 1, unit_price: null, line_total: null };
}

function buildShippingAddress(row: Record<string, string>): string | null {
  const parts = [
    row.shipping_address_1, row.shipping_address_2, row.shipping_city,
    row.shipping_state, row.shipping_postcode, row.shipping_country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function normalizeStatus(status: string): string {
  return (status || "").toLowerCase().replace(/^wc-/, "").trim() || "processing";
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

function mapTrackingStatus(raw: string): string {
  const s = (raw || "").toLowerCase().trim();
  if (s.includes("deliver")) return "delivered";
  if (s.includes("transit") || s.includes("shipped") || s.includes("arrived") || s.includes("departed")) return "in_transit";
  if (s.includes("label") || s.includes("created") || s.includes("pre") || s.includes("new label") || s.includes("not scanned")) return "label_created";
  if (s.includes("pick") || s.includes("accept")) return "in_transit";
  return s || "label_created";
}

function safeDateISO(val: string | undefined | null): string | null {
  if (!val) return null;
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
}

function safeFloat(val: string | undefined | null): number | null {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ""));
  return isNaN(n) ? null : n;
}

// ── WooCommerce CSV Parser ──

export function parseWooCommerceCSV(csvText: string): ParsedOrder[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return result.data.map((row) => {
    const wooStatus = normalizeStatus(row.status || "");
    const lineItems: ParsedLineItem[] = [];
    for (let i = 1; i <= 23; i++) {
      const item = parseLineItem(row[`line_item_${i}`] || "");
      if (item) lineItems.push(item);
    }
    return {
      order_number: (row.order_id || "").trim(),
      order_date: safeDateISO(row.order_date),
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

// ── Pirate Ship / ShipStation CSV Parser ──
// Maps actual Pirate Ship headers: Order ID, Recipient, Email, Tracking Number, Cost, etc.

export function parseShipmentCSV(csvText: string): ParsedShipment[] {
  const result = Papa.parse<Record<string, string>>(csvText, {
    header: true, skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, "_"),
  });
  return result.data.map((row) => {
    // Handle both Pirate Ship headers and generic shipment headers
    const orderNum = (row.order_id || row.order_number || "").toString().trim();
    const trackingStatus = mapTrackingStatus(row.tracking_status || "");
    const shipDate = safeDateISO(row.ship_date || row.tracking_date || null);
    const weightOz = safeFloat(row["weight_(oz)"] || row.weight_oz || row.weight);
    const weightGrams = weightOz != null ? Math.round(weightOz * 28.3495) : null;

    return {
      order_number: orderNum,
      tracking_number: (row.tracking_number || "").trim() || null,
      carrier: (row.carrier || "").trim() || null,
      service: (row.service || "").trim() || null,
      status: trackingStatus,
      carrier_status_detail: (row.tracking_status_description || row.status_description || "").trim() || null,
      shipped_date: trackingStatus !== "label_created" ? shipDate : null,
      delivered_date: trackingStatus === "delivered" ? shipDate : null,
      shipping_cost: safeFloat(row.cost),
      weight_grams: weightGrams,
      order_date: safeDateISO(row.created_date || row.order_date || null),
      woo_status: null,
      order_total: safeFloat(row.order_value || row.order_total),
      customer_name: (row.recipient || row.customer_name || "").trim() || null,
      customer_email: (row.email || "").trim() || null,
      items: (row.items || "").trim() || null,
      shipping_country: (row.country || row.shipping_country || "").trim() || null,
    };
  }).filter(s => s.tracking_number); // Only include rows with tracking numbers
}

// ── Master XLSX Parser ──
// Parses the "All Orders Master" tab from the XLSX hub

export function parseMasterXLSX(data: ArrayBuffer): ParsedMasterRow[] {
  assertXlsxSize(data);
  const workbook = XLSX.read(new Uint8Array(data), { type: "array", cellDates: true });

  // Find the sheet — try "All Orders Master" first, fall back to third sheet or first
  let sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes("all orders") || n.toLowerCase().includes("master")
  );
  if (!sheetName && workbook.SheetNames.length >= 3) sheetName = workbook.SheetNames[2];
  if (!sheetName) sheetName = workbook.SheetNames[0];

  const sheet = workbook.Sheets[sheetName];
  const rows = sanitizeRows(XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: "" }));

  return rows.map((row) => {
    // Normalize keys — XLSX sometimes keeps original casing
    const r: Record<string, string> = {};
    for (const [k, v] of Object.entries(row)) {
      r[k.trim().toLowerCase().replace(/[#\s]+/g, "_")] = String(v ?? "").trim();
    }

    const orderNum = (r.order_ || r.order_number || r.order_id || r["order#"] || "").trim();
    const wooStatus = normalizeStatus(r.woo_status || "");

    return {
      order_number: orderNum,
      order_date: safeDateISO(r.order_date),
      woo_status: wooStatus,
      status: mapToInternalStatus(wooStatus),
      total_amount: safeFloat(r.order_total),
      customer_name: (r.customer_name || "").trim() || null,
      items: (r.items || "").trim() || null,
      shipping_country: (r.shipping_country || "").trim() || null,
      tracking_number: (r.tracking_number || "").trim() || null,
      carrier: (r.carrier || "").trim() || null,
      service: (r.service || "").trim() || null,
      tracking_status: mapTrackingStatus(r.tracking_status || ""),
      tracking_date: safeDateISO(r.tracking_date),
      est_delivery: (r.est_delivery || r.est_deliver || "").trim() || null,
      shipping_cost: safeFloat(r.cost),
    };
  }).filter(r => r.order_number);
}

// ── Auto-Detection ──

export type DetectedSource = 'pirate_ship' | 'woocommerce' | 'master_xlsx' | 'unknown';

const PIRATE_SHIP_HEADERS = ['tracking number', 'tracking status', 'recipient', 'ship date', 'carrier', 'cost'];
const WOOCOMMERCE_HEADERS = ['order_id', 'billing_first_name', 'billing_email', 'order_total', 'shipping_address_1'];

export function detectCSVSource(headers: string[]): DetectedSource {
  const lower = headers.map(h => h.trim().toLowerCase().replace(/\s+/g, ' '));
  const pirateHits = PIRATE_SHIP_HEADERS.filter(ph => lower.some(h => h.includes(ph))).length;
  const wooHits = WOOCOMMERCE_HEADERS.filter(wh => lower.some(h => h.includes(wh))).length;

  if (pirateHits >= 3) return 'pirate_ship';
  if (wooHits >= 3) return 'woocommerce';
  return 'unknown';
}

export function detectCSVSourceFromText(csvText: string): DetectedSource {
  const firstLine = csvText.split('\n')[0] || '';
  const headers = firstLine.replace(/"/g, '').split(',');
  return detectCSVSource(headers);
}

export interface SourceInfo {
  key: string;
  label: string;
  destinationTable: string;
  destinationPage: string;
}

export const SOURCE_INFO: Record<string, SourceInfo> = {
  'WooCommerce': { key: 'woocommerce', label: 'WooCommerce', destinationTable: 'orders', destinationPage: 'Orders' },
  'Pirate Ship': { key: 'pirate_ship', label: 'Pirate Ship', destinationTable: 'shipments', destinationPage: 'Shipments' },
  'ShipStation': { key: 'shipstation', label: 'ShipStation', destinationTable: 'shipments', destinationPage: 'Shipments' },
  'Master XLSX': { key: 'master_xlsx', label: 'Master XLSX', destinationTable: 'orders + shipments', destinationPage: 'Orders & Shipments' },
};

// ── File reading helpers ──

const FILE_READ_TIMEOUT_MS = 30_000;

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => { reader.abort(); reject(new Error("File read timed out. The file may be too large or corrupted.")); }, FILE_READ_TIMEOUT_MS);
    reader.onload = () => { clearTimeout(timer); resolve(reader.result as string); };
    reader.onerror = () => { clearTimeout(timer); reject(reader.error); };
    reader.onabort = () => { clearTimeout(timer); reject(new Error("File read was aborted.")); };
    reader.readAsText(file);
  });
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    const timer = setTimeout(() => { reader.abort(); reject(new Error("File read timed out. The file may be too large or corrupted.")); }, FILE_READ_TIMEOUT_MS);
    reader.onload = () => { clearTimeout(timer); resolve(reader.result as ArrayBuffer); };
    reader.onerror = () => { clearTimeout(timer); reject(reader.error); };
    reader.onabort = () => { clearTimeout(timer); reject(new Error("File read was aborted.")); };
    reader.readAsArrayBuffer(file);
  });
}

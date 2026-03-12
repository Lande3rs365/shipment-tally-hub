import { supabase } from "@/integrations/supabase/client";
import type { ParsedOrder, ParsedShipment, ParsedMasterRow } from "./csvParsers";

const BATCH_SIZE = 100;

export interface ImportPreview {
  newOrders: number;
  updatedOrders: number;
  newShipments: number;
  updatedShipments: number;
  onHoldOrders: number;
  totalRows: number;
}

export interface ImportResult {
  processed: number;
  errors: number;
}

export type ProgressCallback = (processed: number, errors: number) => void;

// ── Helpers ──

/** Fetch all existing records in batches to avoid the 1000-row PostgREST limit */
async function fetchAllExisting(table: string, companyId: string, column: string, values: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const chunk = values.slice(i, i + BATCH_SIZE);
    const { data } = await (supabase as any).from(table).select(`id, ${column}`).eq("company_id", companyId).in(column, chunk);
    for (const row of (data || []) as any[]) {
      map.set(row[column], row.id);
    }
  }
  return map;
}

/** Process items in chunks, calling fn for each chunk */
async function processInChunks<T>(items: T[], chunkSize: number, fn: (chunk: T[]) => Promise<number>): Promise<{ processed: number; errors: number }> {
  let processed = 0, errors = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    try {
      const count = await fn(chunk);
      processed += count;
    } catch {
      errors += chunk.length;
    }
  }
  return { processed, errors };
}

// ── Preview: scan what will be created vs updated ──

export async function previewWooCommerceImport(orders: ParsedOrder[], companyId: string): Promise<ImportPreview> {
  const orderNumbers = orders.map(o => o.order_number);
  const existingMap = await fetchAllExisting("orders", companyId, "order_number", orderNumbers);
  const onHold = orders.filter(o => o.woo_status === "on-hold").length;
  return {
    newOrders: orders.filter(o => !existingMap.has(o.order_number)).length,
    updatedOrders: orders.filter(o => existingMap.has(o.order_number)).length,
    newShipments: 0, updatedShipments: 0, onHoldOrders: onHold, totalRows: orders.length,
  };
}

export async function previewShipmentImport(shipments: ParsedShipment[], companyId: string): Promise<ImportPreview> {
  const trackingNumbers = shipments.filter(s => s.tracking_number).map(s => s.tracking_number!);
  const existingMap = await fetchAllExisting("shipments", companyId, "tracking_number", trackingNumbers);
  return {
    newOrders: 0, updatedOrders: 0,
    newShipments: shipments.filter(s => !s.tracking_number || !existingMap.has(s.tracking_number)).length,
    updatedShipments: shipments.filter(s => s.tracking_number && existingMap.has(s.tracking_number)).length,
    onHoldOrders: 0, totalRows: shipments.length,
  };
}

export async function previewMasterImport(rows: ParsedMasterRow[], companyId: string): Promise<ImportPreview> {
  const orderNumbers = rows.map(r => r.order_number);
  const existingOrderMap = await fetchAllExisting("orders", companyId, "order_number", orderNumbers);

  const trackingNumbers = rows.filter(r => r.tracking_number).map(r => r.tracking_number!);
  const existingShipmentMap = trackingNumbers.length > 0
    ? await fetchAllExisting("shipments", companyId, "tracking_number", trackingNumbers)
    : new Map<string, string>();

  const onHold = rows.filter(r => r.woo_status === "on-hold").length;
  const rowsWithTracking = rows.filter(r => r.tracking_number);

  return {
    newOrders: rows.filter(r => !existingOrderMap.has(r.order_number)).length,
    updatedOrders: rows.filter(r => existingOrderMap.has(r.order_number)).length,
    newShipments: rowsWithTracking.filter(r => !existingShipmentMap.has(r.tracking_number!)).length,
    updatedShipments: rowsWithTracking.filter(r => existingShipmentMap.has(r.tracking_number!)).length,
    onHoldOrders: onHold, totalRows: rows.length,
  };
}

// ── Import: batch write to DB ──

export async function importWooCommerceOrders(orders: ParsedOrder[], companyId: string, userId: string, onProgress?: ProgressCallback): Promise<ImportResult> {
  let totalProcessed = 0, totalErrors = 0;

  // 1. Fetch all existing orders in one pass
  const orderNumbers = orders.map(o => o.order_number);
  const existingMap = await fetchAllExisting("orders", companyId, "order_number", orderNumbers);

  const toInsert = orders.filter(o => !existingMap.has(o.order_number));
  const toUpdate = orders.filter(o => existingMap.has(o.order_number));

  // 2. Batch insert new orders
  for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
    const chunk = toInsert.slice(i, i + BATCH_SIZE);
    try {
      const { data: inserted, error } = await supabase.from("orders").insert(
        chunk.map(o => ({
          company_id: companyId, order_number: o.order_number, order_date: o.order_date,
          status: o.status, woo_status: o.woo_status, customer_name: o.customer_name,
          customer_email: o.customer_email, customer_phone: o.customer_phone,
          shipping_address: o.shipping_address, total_amount: o.total_amount,
          currency: o.currency, source: o.source,
        }))
      ).select("id, order_number");
      if (error) throw error;

      // Map new IDs back
      for (const row of (inserted || [])) {
        existingMap.set(row.order_number, row.id);
      }

      // Batch insert line items for this chunk
      const allLineItems = chunk.flatMap(o => {
        const orderId = existingMap.get(o.order_number);
        return orderId ? o.line_items.map(li => ({
          order_id: orderId, sku: li.sku, quantity: li.quantity, unit_price: li.unit_price, line_total: li.line_total,
        })) : [];
      });
      if (allLineItems.length > 0) {
        await supabase.from("order_items").insert(allLineItems);
      }

      // Batch insert events
      const events = chunk.map(o => ({
        order_id: existingMap.get(o.order_number), event_type: "import_created",
        description: "Order created via WooCommerce CSV import", created_by: userId,
      })).filter(e => e.order_id);
      if (events.length > 0) {
        await supabase.from("order_events").insert(events);
      }

      totalProcessed += chunk.length;
    } catch {
      totalErrors += chunk.length;
    }
    onProgress?.(totalProcessed, totalErrors);
  }

  // 3. Update existing orders one-by-one (updates can't be truly batched in PostgREST)
  //    but we skip the existence check query since we already have the map
  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const chunk = toUpdate.slice(i, i + BATCH_SIZE);
    const updatePromises = chunk.map(async (order) => {
      const orderId = existingMap.get(order.order_number)!;
      try {
        await supabase.from("orders").update({
          order_date: order.order_date, status: order.status, woo_status: order.woo_status,
          customer_name: order.customer_name, customer_email: order.customer_email,
          customer_phone: order.customer_phone, shipping_address: order.shipping_address,
          total_amount: order.total_amount, currency: order.currency, source: order.source,
        }).eq("id", orderId);

        // Replace line items — check errors to avoid leaving order with no items
        const { error: deleteErr } = await supabase.from("order_items").delete().eq("order_id", orderId);
        if (deleteErr) throw deleteErr;
        if (order.line_items.length > 0) {
          const { error: insertErr } = await supabase.from("order_items").insert(order.line_items.map(li => ({
            order_id: orderId, sku: li.sku, quantity: li.quantity, unit_price: li.unit_price, line_total: li.line_total,
          })));
          if (insertErr) throw insertErr;
        }

        return true;
      } catch {
        return false;
      }
    });

    const results = await Promise.all(updatePromises);
    const succeeded = results.filter(Boolean).length;
    totalProcessed += succeeded;
    totalErrors += results.length - succeeded;

    // Batch insert events for updates
    const eventRows = chunk.map(o => ({
      order_id: existingMap.get(o.order_number), event_type: "import_updated",
      description: "Order updated via WooCommerce CSV import", created_by: userId,
    })).filter(e => e.order_id);
    if (eventRows.length > 0) {
      await supabase.from("order_events").insert(eventRows);
    }

    onProgress?.(totalProcessed, totalErrors);
  }

  // 4. Handle on-hold exceptions in batch
  const onHoldOrders = orders.filter(o => o.woo_status === "on-hold");
  if (onHoldOrders.length > 0) {
    await createOnHoldExceptions(companyId, onHoldOrders.map(o => ({
      orderId: existingMap.get(o.order_number)!,
      orderNumber: o.order_number,
      customerName: o.customer_name,
    })), userId);
  }

  return { processed: totalProcessed, errors: totalErrors };
}

export async function importShipments(shipments: ParsedShipment[], companyId: string, userId: string, onProgress?: ProgressCallback): Promise<ImportResult> {
  let totalProcessed = 0, totalErrors = 0;

  // 1. Fetch existing orders and shipments in parallel
  const orderNumbers = [...new Set(shipments.filter(s => s.order_number).map(s => s.order_number!))];
  const trackingNumbers = [...new Set(shipments.filter(s => s.tracking_number).map(s => s.tracking_number!))];

  const [existingOrderMap, existingShipmentMap] = await Promise.all([
    fetchAllExisting("orders", companyId, "order_number", orderNumbers),
    trackingNumbers.length > 0 ? fetchAllExisting("shipments", companyId, "tracking_number", trackingNumbers) : Promise.resolve(new Map<string, string>()),
  ]);

  // 2. Identify orders that need to be created as placeholders
  const missingOrderNumbers = [...new Set(
    shipments.filter(s => s.order_number && !existingOrderMap.has(s.order_number)).map(s => s.order_number!)
  )];

  // Batch create placeholder orders
  for (let i = 0; i < missingOrderNumbers.length; i += BATCH_SIZE) {
    const chunk = missingOrderNumbers.slice(i, i + BATCH_SIZE);
    // Find first shipment for each order number to get customer info
    const orderData = chunk.map(on => {
      const s = shipments.find(sh => sh.order_number === on)!;
      return {
        company_id: companyId, order_number: on, order_date: s.order_date,
        status: "pending", woo_status: "pending",
        customer_name: s.customer_name, customer_email: s.customer_email,
        total_amount: s.order_total, source: "pirate_ship",
      };
    });
    try {
      const { data: inserted } = await supabase.from("orders").insert(orderData).select("id, order_number");
      for (const row of (inserted || [])) {
        existingOrderMap.set(row.order_number, row.id);
      }
    } catch {
      // placeholder orders couldn't be created; affected shipments will be skipped
    }
  }

  // 3. Split shipments into new vs update
  const newShipments = shipments.filter(s => !s.tracking_number || !existingShipmentMap.has(s.tracking_number));
  const updateShipments = shipments.filter(s => s.tracking_number && existingShipmentMap.has(s.tracking_number));

  // 4. Batch insert new shipments
  for (let i = 0; i < newShipments.length; i += BATCH_SIZE) {
    const chunk = newShipments.slice(i, i + BATCH_SIZE);
    const insertData = chunk
      .filter(s => s.order_number && existingOrderMap.has(s.order_number))
      .map(s => ({
        company_id: companyId, order_id: existingOrderMap.get(s.order_number!)!,
        tracking_number: s.tracking_number, carrier: s.carrier, status: s.status,
        carrier_status_detail: s.carrier_status_detail,
        shipped_date: s.shipped_date, delivered_date: s.delivered_date,
        shipping_cost: s.shipping_cost, weight_grams: s.weight_grams,
      }));
    if (insertData.length > 0) {
      try {
        await supabase.from("shipments").insert(insertData);
        totalProcessed += insertData.length;
      } catch {
        totalErrors += insertData.length;
      }
    }
    // Count skipped (no order_number)
    totalProcessed += chunk.length - insertData.length;
    onProgress?.(totalProcessed, totalErrors);
  }

  // 5. Parallel update existing shipments
  for (let i = 0; i < updateShipments.length; i += BATCH_SIZE) {
    const chunk = updateShipments.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(async (s) => {
      try {
        const orderId = s.order_number ? existingOrderMap.get(s.order_number) : undefined;
        await supabase.from("shipments").update({
          status: s.status, shipped_date: s.shipped_date, delivered_date: s.delivered_date,
          shipping_cost: s.shipping_cost, carrier: s.carrier, weight_grams: s.weight_grams,
          carrier_status_detail: s.carrier_status_detail,
          ...(orderId ? { order_id: orderId } : {}),
        }).eq("id", existingShipmentMap.get(s.tracking_number!)!);
        return true;
      } catch { return false; }
    }));
    totalProcessed += results.filter(Boolean).length;
    totalErrors += results.filter(r => !r).length;
    onProgress?.(totalProcessed, totalErrors);
  }

  return { processed: totalProcessed, errors: totalErrors };
}

export async function importMasterRows(rows: ParsedMasterRow[], companyId: string, userId: string, onProgress?: ProgressCallback): Promise<ImportResult> {
  let totalProcessed = 0, totalErrors = 0;

  // 1. Fetch existing orders and shipments
  const orderNumbers = rows.map(r => r.order_number);
  const trackingNumbers = [...new Set(rows.filter(r => r.tracking_number).map(r => r.tracking_number!))];

  const [existingOrderMap, existingShipmentMap] = await Promise.all([
    fetchAllExisting("orders", companyId, "order_number", orderNumbers),
    trackingNumbers.length > 0 ? fetchAllExisting("shipments", companyId, "tracking_number", trackingNumbers) : Promise.resolve(new Map<string, string>()),
  ]);

  const toInsertOrders = rows.filter(r => !existingOrderMap.has(r.order_number));
  const toUpdateOrders = rows.filter(r => existingOrderMap.has(r.order_number));

  // 2. Batch insert new orders
  for (let i = 0; i < toInsertOrders.length; i += BATCH_SIZE) {
    const chunk = toInsertOrders.slice(i, i + BATCH_SIZE);
    try {
      const { data: inserted, error } = await supabase.from("orders").insert(
        chunk.map(r => ({
          company_id: companyId, order_number: r.order_number, order_date: r.order_date,
          status: r.status, woo_status: r.woo_status, customer_name: r.customer_name,
          total_amount: r.total_amount, source: "woocommerce",
        }))
      ).select("id, order_number");
      if (error) throw error;
      for (const row of (inserted || [])) {
        existingOrderMap.set(row.order_number, row.id);
      }
      totalProcessed += chunk.length;
    } catch {
      totalErrors += chunk.length;
    }
    onProgress?.(totalProcessed, totalErrors);
  }

  // 3. Parallel update existing orders
  for (let i = 0; i < toUpdateOrders.length; i += BATCH_SIZE) {
    const chunk = toUpdateOrders.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(chunk.map(async (r) => {
      try {
        await supabase.from("orders").update({
          order_date: r.order_date, status: r.status, woo_status: r.woo_status,
          customer_name: r.customer_name, total_amount: r.total_amount, source: "woocommerce",
        }).eq("id", existingOrderMap.get(r.order_number)!);
        return true;
      } catch { return false; }
    }));
    totalProcessed += results.filter(Boolean).length;
    totalErrors += results.filter(r => !r).length;
    onProgress?.(totalProcessed, totalErrors);
  }

  // 4. Batch upsert shipments
  const rowsWithTracking = rows.filter(r => r.tracking_number && existingOrderMap.has(r.order_number));
  const newShipmentRows = rowsWithTracking.filter(r => !existingShipmentMap.has(r.tracking_number!));
  const updateShipmentRows = rowsWithTracking.filter(r => existingShipmentMap.has(r.tracking_number!));

  for (let i = 0; i < newShipmentRows.length; i += BATCH_SIZE) {
    const chunk = newShipmentRows.slice(i, i + BATCH_SIZE);
    try {
      await supabase.from("shipments").insert(chunk.map(r => ({
        company_id: companyId, order_id: existingOrderMap.get(r.order_number)!,
        tracking_number: r.tracking_number, carrier: r.carrier, status: r.tracking_status,
        shipped_date: r.tracking_status !== "label_created" ? r.tracking_date : null,
        delivered_date: r.tracking_status === "delivered" ? r.tracking_date : null,
        shipping_cost: r.shipping_cost,
      })));
    } catch {
      // shipment insert failed; counted as skipped
    }
  }

  for (let i = 0; i < updateShipmentRows.length; i += BATCH_SIZE) {
    const chunk = updateShipmentRows.slice(i, i + BATCH_SIZE);
    await Promise.all(chunk.map(async (r) => {
      try {
        await supabase.from("shipments").update({
          carrier: r.carrier, status: r.tracking_status,
          shipped_date: r.tracking_status !== "label_created" ? r.tracking_date : null,
          delivered_date: r.tracking_status === "delivered" ? r.tracking_date : null,
          shipping_cost: r.shipping_cost,
        }).eq("id", existingShipmentMap.get(r.tracking_number!)!);
      } catch {}
    }));
  }

  // 5. Batch insert order events
  const allEvents = rows.map(r => ({
    order_id: existingOrderMap.get(r.order_number),
    event_type: toUpdateOrders.some(u => u.order_number === r.order_number) ? "import_updated" : "import_created",
    description: `Order via Master XLSX import`, created_by: userId,
  })).filter(e => e.order_id);
  for (let i = 0; i < allEvents.length; i += BATCH_SIZE) {
    await supabase.from("order_events").insert(allEvents.slice(i, i + BATCH_SIZE));
  }

  // 6. Handle on-hold exceptions
  const onHoldRows = rows.filter(r => r.woo_status === "on-hold" && existingOrderMap.has(r.order_number));
  if (onHoldRows.length > 0) {
    await createOnHoldExceptions(companyId, onHoldRows.map(r => ({
      orderId: existingOrderMap.get(r.order_number)!,
      orderNumber: r.order_number,
      customerName: r.customer_name,
    })), userId);
  }

  return { processed: totalProcessed, errors: totalErrors };
}

// ── On-hold exception helper (batched) ──

async function createOnHoldExceptions(
  companyId: string,
  orders: { orderId: string; orderNumber: string; customerName: string | null }[],
  userId: string,
) {
  if (orders.length === 0) return;

  // Fetch existing open exceptions for these orders
  const orderIds = orders.map(o => o.orderId);
  const existingExceptions = new Set<string>();
  for (let i = 0; i < orderIds.length; i += BATCH_SIZE) {
    const chunk = orderIds.slice(i, i + BATCH_SIZE);
    const { data } = await supabase.from("exceptions").select("linked_order_id")
      .eq("company_id", companyId).eq("exception_type", "on_hold")
      .in("status", ["open", "investigating"]).in("linked_order_id", chunk);
    for (const row of (data || [])) {
      existingExceptions.add(row.linked_order_id);
    }
  }

  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);

  const toCreate = orders
    .filter(o => !existingExceptions.has(o.orderId))
    .map(o => ({
      company_id: companyId, exception_type: "on_hold", severity: "medium", status: "open",
      title: `On-hold: ${o.orderNumber}`,
      description: `Order ${o.orderNumber}${o.customerName ? ` (${o.customerName})` : ""} is on-hold.`,
      linked_order_id: o.orderId, created_by: userId,
      follow_up_due_at: nextWeek.toISOString(),
    }));

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    await supabase.from("exceptions").insert(toCreate.slice(i, i + BATCH_SIZE));
  }
}

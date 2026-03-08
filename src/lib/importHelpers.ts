import { supabase } from "@/integrations/supabase/client";
import type { ParsedOrder, ParsedShipment, ParsedMasterRow } from "./csvParsers";

const db = supabase as any;

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

// ── Preview: scan what will be created vs updated ──

export async function previewWooCommerceImport(orders: ParsedOrder[], companyId: string): Promise<ImportPreview> {
  const orderNumbers = orders.map(o => o.order_number);
  const { data: existing } = await db.from("orders").select("order_number").eq("company_id", companyId).in("order_number", orderNumbers);
  const existingSet = new Set((existing || []).map((e: any) => e.order_number));
  const onHold = orders.filter(o => o.woo_status === "on-hold").length;
  return {
    newOrders: orders.filter(o => !existingSet.has(o.order_number)).length,
    updatedOrders: orders.filter(o => existingSet.has(o.order_number)).length,
    newShipments: 0,
    updatedShipments: 0,
    onHoldOrders: onHold,
    totalRows: orders.length,
  };
}

export async function previewShipmentImport(shipments: ParsedShipment[], companyId: string): Promise<ImportPreview> {
  const trackingNumbers = shipments.filter(s => s.tracking_number).map(s => s.tracking_number!);
  const { data: existing } = await db.from("shipments").select("tracking_number").eq("company_id", companyId).in("tracking_number", trackingNumbers);
  const existingSet = new Set((existing || []).map((e: any) => e.tracking_number));
  return {
    newOrders: 0,
    updatedOrders: 0,
    newShipments: shipments.filter(s => !s.tracking_number || !existingSet.has(s.tracking_number)).length,
    updatedShipments: shipments.filter(s => s.tracking_number && existingSet.has(s.tracking_number)).length,
    onHoldOrders: 0,
    totalRows: shipments.length,
  };
}

export async function previewMasterImport(rows: ParsedMasterRow[], companyId: string): Promise<ImportPreview> {
  const orderNumbers = rows.map(r => r.order_number);
  const { data: existingOrders } = await db.from("orders").select("order_number").eq("company_id", companyId).in("order_number", orderNumbers);
  const existingOrderSet = new Set((existingOrders || []).map((e: any) => e.order_number));

  const trackingNumbers = rows.filter(r => r.tracking_number).map(r => r.tracking_number!);
  let existingShipmentSet = new Set<string>();
  if (trackingNumbers.length > 0) {
    const { data: existingShipments } = await db.from("shipments").select("tracking_number").eq("company_id", companyId).in("tracking_number", trackingNumbers);
    existingShipmentSet = new Set((existingShipments || []).map((e: any) => e.tracking_number));
  }

  const onHold = rows.filter(r => r.woo_status === "on-hold").length;
  const rowsWithTracking = rows.filter(r => r.tracking_number);

  return {
    newOrders: rows.filter(r => !existingOrderSet.has(r.order_number)).length,
    updatedOrders: rows.filter(r => existingOrderSet.has(r.order_number)).length,
    newShipments: rowsWithTracking.filter(r => !existingShipmentSet.has(r.tracking_number!)).length,
    updatedShipments: rowsWithTracking.filter(r => existingShipmentSet.has(r.tracking_number!)).length,
    onHoldOrders: onHold,
    totalRows: rows.length,
  };
}

// ── Import: actually write to DB ──

export async function importWooCommerceOrders(orders: ParsedOrder[], companyId: string, userId: string, onProgress?: ProgressCallback): Promise<ImportResult> {
  let processed = 0, errors = 0;

  for (const order of orders) {
    try {
      const { data: existingOrder } = await db.from("orders").select("id").eq("company_id", companyId).eq("order_number", order.order_number).maybeSingle();
      let orderId: string;

      if (existingOrder) {
        await db.from("orders").update({
          order_date: order.order_date, status: order.status, woo_status: order.woo_status,
          customer_name: order.customer_name, customer_email: order.customer_email,
          customer_phone: order.customer_phone, shipping_address: order.shipping_address,
          total_amount: order.total_amount, currency: order.currency, source: order.source,
        }).eq("id", existingOrder.id);
        orderId = existingOrder.id;
        await db.from("order_items").delete().eq("order_id", orderId);
      } else {
        const { data: newOrder, error: orderErr } = await db.from("orders").insert({
          company_id: companyId, order_number: order.order_number, order_date: order.order_date,
          status: order.status, woo_status: order.woo_status, customer_name: order.customer_name,
          customer_email: order.customer_email, customer_phone: order.customer_phone,
          shipping_address: order.shipping_address, total_amount: order.total_amount,
          currency: order.currency, source: order.source,
        }).select("id").single();
        if (orderErr) throw orderErr;
        orderId = newOrder.id;
      }

      if (order.line_items.length > 0) {
        await db.from("order_items").insert(order.line_items.map(li => ({
          order_id: orderId, sku: li.sku, quantity: li.quantity, unit_price: li.unit_price, line_total: li.line_total,
        })));
      }

      // Auto-create exception for on-hold orders
      if (order.woo_status === "on-hold") {
        await createOnHoldException(companyId, orderId, order.order_number, order.customer_name, userId);
      }

      // Log event
      await db.from("order_events").insert({
        order_id: orderId, event_type: existingOrder ? "import_updated" : "import_created",
        description: `Order ${existingOrder ? "updated" : "created"} via WooCommerce CSV import`,
        created_by: userId,
      });

      processed++;
      onProgress?.(processed, errors);
    } catch (err) {
      console.error(`Error importing order ${order.order_number}:`, err);
      errors++;
      onProgress?.(processed, errors);
    }
  }
  return { processed, errors };
}

export async function importShipments(shipments: ParsedShipment[], companyId: string, userId: string, onProgress?: ProgressCallback): Promise<ImportResult> {
  let processed = 0, errors = 0;

  for (const shipment of shipments) {
    try {
      // Find or create order
      let orderId: string;
      if (shipment.order_number) {
        const { data: order } = await db.from("orders").select("id").eq("company_id", companyId).eq("order_number", shipment.order_number).maybeSingle();
        if (order) {
          orderId = order.id;
        } else {
          const { data: newOrder, error: oErr } = await db.from("orders").insert({
            company_id: companyId, order_number: shipment.order_number,
            order_date: shipment.order_date, status: "processing", woo_status: "processing",
            customer_name: shipment.customer_name, customer_email: shipment.customer_email,
            total_amount: shipment.order_total, source: "pirate_ship",
          }).select("id").single();
          if (oErr) throw oErr;
          orderId = newOrder.id;
        }
      } else {
        // No order number — skip or create placeholder
        processed++;
        continue;
      }

      // Check existing shipment by tracking number
      if (shipment.tracking_number) {
        const { data: existing } = await db.from("shipments").select("id").eq("company_id", companyId).eq("tracking_number", shipment.tracking_number).maybeSingle();
        if (existing) {
          await db.from("shipments").update({
            status: shipment.status, shipped_date: shipment.shipped_date,
            delivered_date: shipment.delivered_date, shipping_cost: shipment.shipping_cost,
            carrier: shipment.carrier, weight_grams: shipment.weight_grams, order_id: orderId,
          }).eq("id", existing.id);
          processed++;
          continue;
        }
      }

      await db.from("shipments").insert({
        company_id: companyId, order_id: orderId, tracking_number: shipment.tracking_number,
        carrier: shipment.carrier, status: shipment.status, shipped_date: shipment.shipped_date,
        delivered_date: shipment.delivered_date, shipping_cost: shipment.shipping_cost,
        weight_grams: shipment.weight_grams,
      });
      processed++;
    } catch (err) {
      console.error(`Error importing shipment for order ${shipment.order_number}:`, err);
      errors++;
    }
  }
  return { processed, errors };
}

export async function importMasterRows(rows: ParsedMasterRow[], companyId: string, userId: string): Promise<ImportResult> {
  let processed = 0, errors = 0;

  for (const row of rows) {
    try {
      // Upsert order
      const { data: existingOrder } = await db.from("orders").select("id").eq("company_id", companyId).eq("order_number", row.order_number).maybeSingle();
      let orderId: string;

      if (existingOrder) {
        await db.from("orders").update({
          order_date: row.order_date, status: row.status, woo_status: row.woo_status,
          customer_name: row.customer_name, total_amount: row.total_amount, source: "woocommerce",
        }).eq("id", existingOrder.id);
        orderId = existingOrder.id;
      } else {
        const { data: newOrder, error: oErr } = await db.from("orders").insert({
          company_id: companyId, order_number: row.order_number, order_date: row.order_date,
          status: row.status, woo_status: row.woo_status, customer_name: row.customer_name,
          total_amount: row.total_amount, source: "woocommerce",
        }).select("id").single();
        if (oErr) throw oErr;
        orderId = newOrder.id;
      }

      // On-hold → exception
      if (row.woo_status === "on-hold") {
        await createOnHoldException(companyId, orderId, row.order_number, row.customer_name, userId);
      }

      // Upsert shipment if tracking number exists
      if (row.tracking_number) {
        const { data: existingShipment } = await db.from("shipments").select("id").eq("company_id", companyId).eq("tracking_number", row.tracking_number).maybeSingle();

        const shipmentData = {
          carrier: row.carrier, status: row.tracking_status,
          shipped_date: row.tracking_status !== "label_created" ? row.tracking_date : null,
          delivered_date: row.tracking_status === "delivered" ? row.tracking_date : null,
          shipping_cost: row.shipping_cost,
        };

        if (existingShipment) {
          await db.from("shipments").update(shipmentData).eq("id", existingShipment.id);
        } else {
          await db.from("shipments").insert({
            ...shipmentData, company_id: companyId, order_id: orderId, tracking_number: row.tracking_number,
          });
        }
      }

      // Log event
      await db.from("order_events").insert({
        order_id: orderId, event_type: existingOrder ? "import_updated" : "import_created",
        description: `Order ${existingOrder ? "updated" : "created"} via Master XLSX import`,
        created_by: userId,
      });

      processed++;
    } catch (err) {
      console.error(`Error importing master row ${row.order_number}:`, err);
      errors++;
    }
  }
  return { processed, errors };
}

// ── On-hold exception helper ──

async function createOnHoldException(companyId: string, orderId: string, orderNumber: string, customerName: string | null, userId: string) {
  // Check if an open exception already exists for this order
  const { data: existing } = await db.from("exceptions").select("id").eq("company_id", companyId).eq("linked_order_id", orderId).eq("exception_type", "on_hold").in("status", ["open", "investigating"]).maybeSingle();

  if (!existing) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    await db.from("exceptions").insert({
      company_id: companyId,
      exception_type: "on_hold",
      severity: "medium",
      status: "open",
      title: `On-hold: ${orderNumber}`,
      description: `Order ${orderNumber}${customerName ? ` (${customerName})` : ""} is on-hold. Customer needs to be contacted / department chased for solution.`,
      linked_order_id: orderId,
      created_by: userId,
      follow_up_due_at: nextWeek.toISOString(),
    });
  }
}

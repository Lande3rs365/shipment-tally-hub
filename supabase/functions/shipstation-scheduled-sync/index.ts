import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const SHIPSTATION_BASE = "https://ssapi.shipstation.com";

const CARRIER_MAP: Record<string, string> = {
  usps: "USPS", stamps_com: "USPS", "stamps.com": "USPS",
  fedex: "FedEx", ups: "UPS", dhl: "DHL",
  dhl_express: "DHL Express", amazon: "Amazon",
  ontrac: "OnTrac", lasership: "LaserShip",
};

function mapCarrier(raw: string | null): string {
  if (!raw) return "Other";
  const key = raw.toLowerCase().replace(/[\s-]/g, "_");
  return CARRIER_MAP[key] || raw;
}

function mapShipmentStatus(raw: string | null): string {
  if (!raw) return "pending";
  const s = raw.toLowerCase();
  if (s === "shipped" || s === "fulfilled") return "shipped";
  if (s === "delivered") return "delivered";
  if (s === "cancelled" || s === "voided") return "cancelled";
  return "pending";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Auth: only allow cron (anon key) or service role ──
  const authHeader = req.headers.get("Authorization");
  const expectedAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const bearerToken = authHeader.replace("Bearer ", "");
  if (bearerToken !== expectedAnonKey && bearerToken !== expectedServiceKey) {
    // Not a cron/service call — reject
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const testClient = createClient(supabaseUrl, expectedAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: claimsErr } = await testClient.auth.getClaims(bearerToken);
    if (claimsErr) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    return jsonResponse({ error: "Forbidden: scheduled sync is system-only" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, expectedServiceKey);

  // ── Find integrations due for sync ──
  const { data: integrations, error: fetchErr } = await supabase
    .from("shipstation_integrations")
    .select("*")
    .gt("sync_interval_minutes", 0);

  if (fetchErr) {
    console.error("Failed to fetch ShipStation integrations:", fetchErr);
    return jsonResponse({ error: "Internal error" }, 500);
  }

  const now = new Date();
  const dueIntegrations = (integrations || []).filter((int: any) => {
    if (!int.last_sync_at) return true;
    const lastSync = new Date(int.last_sync_at);
    const nextDue = new Date(lastSync.getTime() + int.sync_interval_minutes * 60 * 1000);
    return now >= nextDue;
  });

  if (dueIntegrations.length === 0) {
    return jsonResponse({ message: "No ShipStation integrations due for sync", synced: 0 });
  }

  const results: { company_id: string; status: string; orders: number; shipments: number; error?: string }[] = [];

  for (const integration of dueIntegrations) {
    const { company_id, api_key, api_secret, last_sync_at } = integration;
    const authString = btoa(`${api_key}:${api_secret}`);

    try {
      // ── Sync Orders ──
      let ordersSynced = 0;
      {
        const allOrders: any[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= 50) {
          const params = new URLSearchParams({
            pageSize: "100",
            page: String(page),
            sortBy: "OrderDate",
            sortDir: "DESC",
          });
          if (last_sync_at) {
            params.set("modifyDateStart", last_sync_at);
          }

          const res = await fetch(`${SHIPSTATION_BASE}/orders?${params}`, {
            headers: { Authorization: `Basic ${authString}` },
          });
          if (!res.ok) throw new Error(`ShipStation orders returned ${res.status}`);

          const data = await res.json();
          allOrders.push(...(data.orders || []));
          totalPages = data.pages || 1;
          page++;
        }

        if (allOrders.length > 0) {
          const BATCH = 50;
          for (let i = 0; i < allOrders.length; i += BATCH) {
            const batch = allOrders.slice(i, i + BATCH);
            const orderRows = batch.map((ss: any) => {
              const ship = ss.shipTo || {};
              const statusMap: Record<string, string> = {
                awaiting_payment: "pending", awaiting_shipment: "processing",
                on_hold: "processing", shipped: "completed",
                cancelled: "cancelled",
              };
              return {
                company_id,
                order_number: String(ss.orderNumber || ""),
                order_date: ss.orderDate || null,
                status: statusMap[ss.orderStatus] || "pending",
                customer_name: ship.name || null,
                customer_email: ss.customerEmail || null,
                shipping_address: [ship.street1, ship.street2, ship.city, ship.state, ship.postalCode, ship.country]
                  .filter(Boolean).join(", ") || null,
                total_amount: parseFloat(ss.orderTotal) || null,
                currency: "USD",
                source: "shipstation_api",
              };
            }).filter((r: any) => r.order_number);

            if (orderRows.length === 0) continue;

            const { error: upsertErr } = await supabase.from("orders").upsert(
              orderRows,
              { onConflict: "company_id,order_number", ignoreDuplicates: false }
            );
            if (upsertErr) {
              // Fallback: insert one-by-one
              for (const row of orderRows) {
                const { error: singleErr } = await supabase.from("orders").upsert(
                  row, { onConflict: "company_id,order_number", ignoreDuplicates: false }
                );
                if (!singleErr) ordersSynced++;
              }
            } else {
              ordersSynced += orderRows.length;
            }
          }
        }
      }

      // ── Sync Shipments ──
      let shipmentsSynced = 0;
      {
        const allShipments: any[] = [];
        let page = 1;
        let totalPages = 1;

        while (page <= totalPages && page <= 50) {
          const params = new URLSearchParams({
            pageSize: "100",
            page: String(page),
            sortBy: "ShipDate",
            sortDir: "DESC",
          });
          if (last_sync_at) {
            params.set("shipDateStart", last_sync_at);
          }

          const res = await fetch(`${SHIPSTATION_BASE}/shipments?${params}`, {
            headers: { Authorization: `Basic ${authString}` },
          });
          if (!res.ok) throw new Error(`ShipStation shipments returned ${res.status}`);

          const data = await res.json();
          allShipments.push(...(data.shipments || []));
          totalPages = data.pages || 1;
          page++;
        }

        if (allShipments.length > 0) {
          const BATCH = 50;
          for (let i = 0; i < allShipments.length; i += BATCH) {
            const batch = allShipments.slice(i, i + BATCH);

            for (const ss of batch) {
              const orderNum = String(ss.orderNumber || "");
              if (!orderNum) continue;

              // Find or create the order
              let { data: order } = await supabase
                .from("orders")
                .select("id")
                .eq("company_id", company_id)
                .eq("order_number", orderNum)
                .maybeSingle();

              if (!order) {
                const { data: newOrder } = await supabase
                  .from("orders")
                  .insert({
                    company_id,
                    order_number: orderNum,
                    status: "completed",
                    source: "shipstation_api",
                    currency: "USD",
                  })
                  .select("id")
                  .single();
                order = newOrder;
              }

              if (!order) continue;

              const shipmentRow = {
                company_id,
                order_id: order.id,
                shipment_number: String(ss.shipmentId || ""),
                carrier: mapCarrier(ss.carrierCode),
                tracking_number: ss.trackingNumber || null,
                status: mapShipmentStatus(ss.voidDate ? "cancelled" : "shipped"),
                shipped_date: ss.shipDate || null,
                delivered_date: null,
                weight_grams: ss.weight ? Math.round((ss.weight.value || 0) * 28.3495) : null,
                shipping_cost: parseFloat(ss.shipmentCost) || null,
                carrier_status_detail: ss.carrierCode || null,
              };

              const { error: shipErr } = await supabase
                .from("shipments")
                .upsert(shipmentRow, {
                  onConflict: "company_id,shipment_number",
                  ignoreDuplicates: false,
                });

              if (!shipErr) shipmentsSynced++;
            }
          }
        }
      }

      // ── Update sync status ──
      await supabase.from("shipstation_integrations").update({
        last_sync_at: now.toISOString(),
        last_sync_order_count: ordersSynced,
        last_sync_shipment_count: shipmentsSynced,
        last_sync_status: "success",
        last_sync_error: null,
      }).eq("company_id", company_id);

      results.push({ company_id, status: "success", orders: ordersSynced, shipments: shipmentsSynced });
    } catch (err: any) {
      console.error(`ShipStation sync failed for company ${company_id}:`, err?.message);
      await supabase.from("shipstation_integrations").update({
        last_sync_status: "error",
        last_sync_error: err?.message || "Unknown error",
      }).eq("company_id", company_id);
      results.push({ company_id, status: "error", orders: 0, shipments: 0, error: err?.message });
    }
  }

  return jsonResponse({ synced: results.length, results });
});

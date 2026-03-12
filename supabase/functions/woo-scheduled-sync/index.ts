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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Find all integrations that are due for auto-sync
  // sync_interval_minutes > 0 AND (last_sync_at is null OR last_sync_at + interval < now())
  const { data: integrations, error: fetchErr } = await supabase
    .from("woocommerce_integrations")
    .select("*")
    .gt("sync_interval_minutes", 0);

  if (fetchErr) {
    console.error("Failed to fetch integrations:", fetchErr);
    return jsonResponse({ error: "Failed to fetch integrations" }, 500);
  }

  const now = new Date();
  const dueIntegrations = (integrations || []).filter((int: any) => {
    if (!int.last_sync_at) return true; // never synced
    const lastSync = new Date(int.last_sync_at);
    const nextDue = new Date(lastSync.getTime() + int.sync_interval_minutes * 60 * 1000);
    return now >= nextDue;
  });

  if (dueIntegrations.length === 0) {
    return jsonResponse({ message: "No integrations due for sync", synced: 0 });
  }

  const results: { company_id: string; status: string; orders: number; error?: string }[] = [];

  for (const integration of dueIntegrations) {
    const { company_id, store_url, consumer_key, consumer_secret, last_sync_at } = integration;
    const baseUrl = store_url.replace(/\/+$/, "");
    const authString = btoa(`${consumer_key}:${consumer_secret}`);

    try {
      // Fetch all orders since last sync, paginating
      const allOrders: any[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const params = new URLSearchParams({
          per_page: "100",
          page: String(page),
          orderby: "date",
          order: "desc",
        });
        if (last_sync_at) {
          params.set("after", last_sync_at);
        }

        const res = await fetch(`${baseUrl}/wp-json/wc/v3/orders?${params}`, {
          headers: { Authorization: `Basic ${authString}` },
        });

        if (!res.ok) {
          throw new Error(`WooCommerce returned ${res.status}`);
        }

        const orders = await res.json();
        allOrders.push(...orders);
        totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
        page++;
      }

      if (allOrders.length === 0) {
        // No new orders — just update last_sync_at
        await supabase.from("woocommerce_integrations").update({
          last_sync_at: now.toISOString(),
          last_sync_order_count: 0,
          last_sync_status: "success",
          last_sync_error: null,
        }).eq("company_id", company_id);

        results.push({ company_id, status: "success", orders: 0 });
        continue;
      }

      // Transform and upsert orders
      let processed = 0;
      let errors = 0;
      const BATCH = 50;

      for (let i = 0; i < allOrders.length; i += BATCH) {
        const batch = allOrders.slice(i, i + BATCH);
        const orderRows = batch.map((woo: any) => {
          const shipping = woo.shipping || {};
          const billing = woo.billing || {};
          const addressParts = [
            [shipping.first_name, shipping.last_name].filter(Boolean).join(" "),
            shipping.address_1, shipping.address_2,
            [shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(", "),
            shipping.country,
          ].filter(Boolean);

          const statusMap: Record<string, string> = {
            processing: "processing", "on-hold": "processing", pending: "pending",
            completed: "completed", cancelled: "cancelled", refunded: "cancelled", failed: "cancelled",
          };

          return {
            company_id,
            order_number: String(woo.number),
            order_date: woo.date_created || null,
            status: statusMap[woo.status] || "pending",
            woo_status: woo.status,
            customer_name: [billing.first_name, billing.last_name].filter(Boolean).join(" ") || null,
            customer_email: billing.email || null,
            customer_phone: billing.phone || null,
            shipping_address: addressParts.join(", ") || null,
            total_amount: parseFloat(woo.total) || null,
            currency: woo.currency || "AUD",
            source: "woocommerce_api",
          };
        });

        // Upsert by order_number + company_id
        const { error: upsertErr } = await supabase.from("orders").upsert(
          orderRows,
          { onConflict: "company_id,order_number", ignoreDuplicates: false }
        );

        if (upsertErr) {
          // Fallback: insert individually
          for (const row of orderRows) {
            const { error: singleErr } = await supabase.from("orders").upsert(
              row,
              { onConflict: "company_id,order_number", ignoreDuplicates: false }
            );
            if (singleErr) errors++;
            else processed++;
          }
        } else {
          processed += batch.length;
        }
      }

      await supabase.from("woocommerce_integrations").update({
        last_sync_at: now.toISOString(),
        last_sync_order_count: processed,
        last_sync_status: errors > 0 ? "partial" : "success",
        last_sync_error: errors > 0 ? `${errors} orders failed to import` : null,
      }).eq("company_id", company_id);

      results.push({ company_id, status: errors > 0 ? "partial" : "success", orders: processed });
    } catch (err: any) {
      console.error(`Sync failed for company ${company_id}:`, err);
      await supabase.from("woocommerce_integrations").update({
        last_sync_status: "error",
        last_sync_error: err?.message || "Unknown error",
      }).eq("company_id", company_id);

      results.push({ company_id, status: "error", orders: 0, error: err?.message });
    }
  }

  return jsonResponse({ synced: results.length, results });
});

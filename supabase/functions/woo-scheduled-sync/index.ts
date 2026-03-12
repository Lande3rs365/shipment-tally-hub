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

// ── SSRF Protection (same as woo-proxy) ──
function isValidStoreUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return false;
    const hostname = parsed.hostname.toLowerCase();
    const blockedPatterns = [
      "localhost", "127.0.0.1", "0.0.0.0", "::1",
      "169.254.", "10.", "192.168.", "172.16.", "172.17.", "172.18.",
      "172.19.", "172.20.", "172.21.", "172.22.", "172.23.", "172.24.",
      "172.25.", "172.26.", "172.27.", "172.28.", "172.29.", "172.30.", "172.31.",
      ".internal", ".local", ".localhost",
      "metadata.google", "metadata.aws",
    ];
    for (const pattern of blockedPatterns) {
      if (hostname === pattern || hostname.startsWith(pattern) || hostname.endsWith(pattern)) {
        return false;
      }
    }
    if (!hostname.includes(".")) return false;
    return true;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── Authenticate scheduled call via shared secret ──
  // pg_cron calls with the anon key in Authorization header.
  // We verify the caller is either the anon key (cron) or has a valid service role.
  const authHeader = req.headers.get("Authorization");
  const expectedAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const expectedServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  if (!authHeader) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const bearerToken = authHeader.replace("Bearer ", "");
  // Only allow calls from pg_cron (anon key) or service role
  if (bearerToken !== expectedAnonKey && bearerToken !== expectedServiceKey) {
    // Not a cron call — verify as a real user with getClaims
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const testClient = createClient(supabaseUrl, expectedAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { error: claimsErr } = await testClient.auth.getClaims(bearerToken);
    if (claimsErr) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    // User tokens are not allowed to trigger scheduled sync
    return jsonResponse({ error: "Forbidden: scheduled sync is system-only" }, 403);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabase = createClient(supabaseUrl, expectedServiceKey);

  // Find all integrations that are due for auto-sync
  const { data: integrations, error: fetchErr } = await supabase
    .from("woocommerce_integrations")
    .select("*")
    .gt("sync_interval_minutes", 0);

  if (fetchErr) {
    console.error("Failed to fetch integrations:", fetchErr);
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
    return jsonResponse({ message: "No integrations due for sync", synced: 0 });
  }

  const results: { company_id: string; status: string; orders: number; error?: string }[] = [];

  for (const integration of dueIntegrations) {
    const { company_id, store_url, consumer_key, consumer_secret, last_sync_at } = integration;

    // SSRF check
    if (!isValidStoreUrl(store_url)) {
      console.error(`Skipping company ${company_id}: invalid store URL`);
      await supabase.from("woocommerce_integrations").update({
        last_sync_status: "error",
        last_sync_error: "Invalid store URL: must be HTTPS and a public domain",
      }).eq("company_id", company_id);
      results.push({ company_id, status: "error", orders: 0, error: "Invalid store URL" });
      continue;
    }

    const baseUrl = store_url.replace(/\/+$/, "");
    const authString = btoa(`${consumer_key}:${consumer_secret}`);

    try {
      const allOrders: any[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages && page <= 50) { // Cap at 50 pages to prevent runaway
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
        if (!Array.isArray(orders)) {
          throw new Error("Unexpected response format from WooCommerce");
        }
        allOrders.push(...orders);
        totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
        page++;
      }

      if (allOrders.length === 0) {
        await supabase.from("woocommerce_integrations").update({
          last_sync_at: now.toISOString(),
          last_sync_order_count: 0,
          last_sync_status: "success",
          last_sync_error: null,
        }).eq("company_id", company_id);
        results.push({ company_id, status: "success", orders: 0 });
        continue;
      }

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
            order_number: String(woo.number || ""),
            order_date: woo.date_created || null,
            status: statusMap[woo.status] || "pending",
            woo_status: woo.status || "pending",
            customer_name: [billing.first_name, billing.last_name].filter(Boolean).join(" ") || null,
            customer_email: billing.email || null,
            customer_phone: billing.phone || null,
            shipping_address: addressParts.join(", ") || null,
            total_amount: parseFloat(woo.total) || null,
            currency: woo.currency || "AUD",
            source: "woocommerce_api",
          };
        }).filter((r: any) => r.order_number); // Skip orders with no number

        if (orderRows.length === 0) continue;

        const { error: upsertErr } = await supabase.from("orders").upsert(
          orderRows,
          { onConflict: "company_id,order_number", ignoreDuplicates: false }
        );

        if (upsertErr) {
          for (const row of orderRows) {
            const { error: singleErr } = await supabase.from("orders").upsert(
              row,
              { onConflict: "company_id,order_number", ignoreDuplicates: false }
            );
            if (singleErr) errors++;
            else processed++;
          }
        } else {
          processed += orderRows.length;
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
      console.error(`Sync failed for company ${company_id}:`, err?.message);
      await supabase.from("woocommerce_integrations").update({
        last_sync_status: "error",
        last_sync_error: err?.message || "Unknown error",
      }).eq("company_id", company_id);
      results.push({ company_id, status: "error", orders: 0, error: err?.message });
    }
  }

  return jsonResponse({ synced: results.length, results });
});

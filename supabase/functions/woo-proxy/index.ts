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

// ── SSRF Protection ──
function isValidStoreUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    // Must be HTTPS
    if (parsed.protocol !== "https:") return false;
    // Block internal/private hostnames
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
    // Must have a real TLD (at least one dot)
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

  // ── Auth ──
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
  if (claimsErr || !claimsData?.claims) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const userId = claimsData.claims.sub as string;

  // ── Parse request ──
  let body: {
    company_id: string;
    action: "test" | "fetch_orders";
    after?: string;
    page?: number;
    per_page?: number;
  };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const { company_id, action } = body;
  if (!company_id || !action) {
    return jsonResponse({ error: "company_id and action are required" }, 400);
  }

  // Validate UUID format for company_id
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(company_id)) {
    return jsonResponse({ error: "Invalid company_id" }, 400);
  }

  // ── Verify membership + role (owner or admin only) ──
  const serviceClient = createClient(
    supabaseUrl,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: membership } = await serviceClient
    .from("user_companies")
    .select("id, role")
    .eq("user_id", userId)
    .eq("company_id", company_id)
    .maybeSingle();

  if (!membership) {
    return jsonResponse({ error: "Forbidden" }, 403);
  }

  if (membership.role !== "owner" && membership.role !== "admin") {
    return jsonResponse({ error: "Forbidden: owner or admin role required" }, 403);
  }

  // ── Fetch WooCommerce credentials ──
  const { data: integration, error: intErr } = await serviceClient
    .from("woocommerce_integrations")
    .select("store_url, consumer_key, consumer_secret")
    .eq("company_id", company_id)
    .maybeSingle();

  if (intErr || !integration) {
    return jsonResponse({ error: "No WooCommerce integration configured" }, 404);
  }

  const { store_url, consumer_key, consumer_secret } = integration;

  // ── SSRF validation ──
  if (!isValidStoreUrl(store_url)) {
    return jsonResponse({ error: "Invalid store URL: must be HTTPS and a public domain" }, 400);
  }

  const baseUrl = store_url.replace(/\/+$/, "");
  const authString = btoa(`${consumer_key}:${consumer_secret}`);

  try {
    if (action === "test") {
      const url = `${baseUrl}/wp-json/wc/v3/orders?per_page=1`;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) {
        return jsonResponse(
          { error: `WooCommerce returned ${res.status}` },
          502,
        );
      }
      const data = await res.json();
      return jsonResponse({ success: true, order_count: Array.isArray(data) ? data.length : 0 });
    }

    if (action === "fetch_orders") {
      const page = Math.max(1, Math.min(body.page || 1, 1000));
      const perPage = Math.max(1, Math.min(body.per_page || 100, 100));
      const params = new URLSearchParams({
        per_page: String(perPage),
        page: String(page),
        orderby: "date",
        order: "desc",
      });
      if (body.after) {
        // Validate ISO date format
        if (isNaN(Date.parse(body.after))) {
          return jsonResponse({ error: "Invalid 'after' date format" }, 400);
        }
        params.set("after", body.after);
      }

      const url = `${baseUrl}/wp-json/wc/v3/orders?${params}`;
      const res = await fetch(url, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) {
        return jsonResponse(
          { error: `WooCommerce returned ${res.status}` },
          502,
        );
      }

      const orders = await res.json();
      const totalPages = parseInt(res.headers.get("x-wp-totalpages") || "1", 10);
      const totalOrders = parseInt(res.headers.get("x-wp-total") || "0", 10);

      return jsonResponse({ orders, total_pages: totalPages, total_orders: totalOrders, page });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    console.error("WooCommerce proxy error:", err?.message);
    return jsonResponse({ error: "Failed to reach WooCommerce store" }, 502);
  }
});

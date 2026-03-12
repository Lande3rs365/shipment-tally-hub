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
    action: "test" | "fetch_orders" | "fetch_shipments";
    page?: number;
    page_size?: number;
    since?: string;
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

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(company_id)) {
    return jsonResponse({ error: "Invalid company_id" }, 400);
  }

  // ── Verify membership + role ──
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

  // ── Fetch ShipStation credentials ──
  const { data: integration, error: intErr } = await serviceClient
    .from("shipstation_integrations")
    .select("api_key, api_secret")
    .eq("company_id", company_id)
    .maybeSingle();

  if (intErr || !integration) {
    return jsonResponse({ error: "No ShipStation integration configured" }, 404);
  }

  const authString = btoa(`${integration.api_key}:${integration.api_secret}`);

  try {
    if (action === "test") {
      const res = await fetch(`${SHIPSTATION_BASE}/orders?pageSize=1&page=1`, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) {
        return jsonResponse({ error: `ShipStation returned ${res.status}` }, 502);
      }
      const data = await res.json();
      return jsonResponse({ success: true, total: data.total || 0 });
    }

    if (action === "fetch_orders") {
      const page = Math.max(1, Math.min(body.page || 1, 500));
      const pageSize = Math.max(1, Math.min(body.page_size || 100, 500));
      const params = new URLSearchParams({
        pageSize: String(pageSize),
        page: String(page),
        sortBy: "OrderDate",
        sortDir: "DESC",
      });
      if (body.since) {
        if (isNaN(Date.parse(body.since))) {
          return jsonResponse({ error: "Invalid 'since' date format" }, 400);
        }
        params.set("modifyDateStart", body.since);
      }

      const res = await fetch(`${SHIPSTATION_BASE}/orders?${params}`, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) {
        return jsonResponse({ error: `ShipStation returned ${res.status}` }, 502);
      }
      const data = await res.json();
      return jsonResponse({
        orders: data.orders || [],
        total: data.total || 0,
        page: data.page || page,
        pages: data.pages || 1,
      });
    }

    if (action === "fetch_shipments") {
      const page = Math.max(1, Math.min(body.page || 1, 500));
      const pageSize = Math.max(1, Math.min(body.page_size || 100, 500));
      const params = new URLSearchParams({
        pageSize: String(pageSize),
        page: String(page),
        sortBy: "ShipDate",
        sortDir: "DESC",
      });
      if (body.since) {
        if (isNaN(Date.parse(body.since))) {
          return jsonResponse({ error: "Invalid 'since' date format" }, 400);
        }
        params.set("shipDateStart", body.since);
      }

      const res = await fetch(`${SHIPSTATION_BASE}/shipments?${params}`, {
        headers: { Authorization: `Basic ${authString}` },
      });
      if (!res.ok) {
        return jsonResponse({ error: `ShipStation returned ${res.status}` }, 502);
      }
      const data = await res.json();
      return jsonResponse({
        shipments: data.shipments || [],
        total: data.total || 0,
        page: data.page || page,
        pages: data.pages || 1,
      });
    }

    return jsonResponse({ error: "Invalid action" }, 400);
  } catch (err: any) {
    console.error("ShipStation proxy error:", err?.message);
    return jsonResponse({ error: "Failed to reach ShipStation" }, 502);
  }
});

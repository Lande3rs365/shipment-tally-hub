import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // --- Authorization: verify caller belongs to the company ---
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { products, company_id } = await req.json();

    if (!products || !company_id) {
      return new Response(JSON.stringify({ error: "Missing products or company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the authenticated user is a member of the target company
    const { data: membership, error: memberErr } = await userClient
      .from("user_companies")
      .select("id")
      .eq("user_id", user.id)
      .eq("company_id", company_id)
      .maybeSingle();

    if (memberErr || !membership) {
      return new Response(JSON.stringify({ error: "You do not have access to this company" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorized: proceed with service-role client for bulk insert ---
    const supabase = createClient(supabaseUrl, serviceKey);

    // Pass 1: Insert parents (MODEL rows) and standalones
    const parents = products.filter((p: any) => p.row_type === 'parent' || p.row_type === 'standalone');
    const variants = products.filter((p: any) => p.row_type === 'variant');

    const parentRows = parents.map((p: any) => ({
      company_id, sku: p.sku, name: p.name,
      category: p.category, row_type: p.row_type, description: p.description,
    }));

    // Batch insert parents (100 at a time)
    const skuToId = new Map<string, string>();
    for (let i = 0; i < parentRows.length; i += 100) {
      const batch = parentRows.slice(i, i + 100);
      const { data: inserted, error } = await supabase.from('products').insert(batch).select('sku, id');
      if (error) throw error;
      for (const row of inserted || []) skuToId.set(row.sku, row.id);
    }

    // Pass 2: Insert variants with parent_product_id
    const variantRows = variants.map((v: any) => {
      const segments = v.sku.split('-');
      let parentId: string | null = null;
      for (let len = segments.length - 1; len >= 2; len--) {
        const candidate = segments.slice(0, len).join('-');
        if (skuToId.has(candidate)) {
          parentId = skuToId.get(candidate)!;
          break;
        }
      }
      return {
        company_id, sku: v.sku, name: v.name,
        category: v.category, row_type: v.row_type, description: v.description,
        parent_product_id: parentId,
      };
    });

    let variantCreated = 0;
    for (let i = 0; i < variantRows.length; i += 100) {
      const batch = variantRows.slice(i, i + 100);
      const { data: inserted, error } = await supabase.from('products').insert(batch).select('sku, id');
      if (error) throw error;
      variantCreated += (inserted || []).length;
    }

    return new Response(JSON.stringify({
      success: true,
      parents_created: parentRows.length,
      variants_created: variantCreated,
      total: parentRows.length + variantCreated,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err: any) {
    console.error('bulk-import error:', err);
    const isDbConstraint = err?.code?.startsWith('23');
    const userMsg = isDbConstraint
      ? 'One or more products conflict with existing data (duplicate SKU or constraint violation).'
      : 'An unexpected error occurred during import. Please try again.';
    return new Response(JSON.stringify({ error: userMsg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

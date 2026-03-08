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
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { products, company_id } = await req.json();
    
    if (!products || !company_id) {
      return new Response(JSON.stringify({ error: "Missing products or company_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
    // Resolve parent by removing last SKU segment
    const variantRows = variants.map((v: any) => {
      const segments = v.sku.split('-');
      const parentSku = segments.length >= 3 ? segments.slice(0, -1).join('-') : null;
      return {
        company_id, sku: v.sku, name: v.name,
        category: v.category, row_type: v.row_type, description: v.description,
        parent_product_id: parentSku ? skuToId.get(parentSku) || null : null,
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
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

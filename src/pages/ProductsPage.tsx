import { useState } from "react";
import { useProducts, useSyncProducts } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Tag, Search, RefreshCw, Save, X, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

type EditingRow = {
  id: string;
  name: string;
  unit_cost: string;
  sale_price: string;
  reorder_point: string;
  weight_grams: string;
  description: string;
};

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const { currentCompany } = useCompany();
  const { data: products = [], isLoading } = useProducts();
  const syncMutation = useSyncProducts();
  const queryClient = useQueryClient();

  const filtered = products.filter(p =>
    p.sku.toLowerCase().includes(search.toLowerCase()) ||
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSync = async () => {
    try {
      const result = await syncMutation.mutateAsync();
      if (result.created === 0) {
        toast.info("All SKUs already have product records — nothing to sync.");
      } else {
        toast.success(`Created ${result.created} new product stub${result.created > 1 ? "s" : ""} from order data.`);
      }
    } catch (err: any) {
      toast.error("Sync failed: " + (err.message || "Unknown error"));
    }
  };

  const startEdit = (p: any) => {
    setEditing({
      id: p.id,
      name: p.name || "",
      unit_cost: p.unit_cost?.toString() || "",
      sale_price: p.sale_price?.toString() || "",
      reorder_point: p.reorder_point?.toString() || "0",
      weight_grams: p.weight_grams?.toString() || "",
      description: p.description || "",
    });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { id, name, unit_cost, sale_price, reorder_point, weight_grams, description } = editing;
    const { error } = await (supabase as any).from("products").update({
      name: name.trim() || editing.id,
      unit_cost: unit_cost ? parseFloat(unit_cost) : null,
      sale_price: sale_price ? parseFloat(sale_price) : null,
      reorder_point: reorder_point ? parseInt(reorder_point) : 0,
      weight_grams: weight_grams ? parseInt(weight_grams) : null,
      description: description.trim() || null,
    }).eq("id", id);

    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    toast.success("Product updated.");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground">{products.length} active products</p>
        </div>
        <button
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={cn("w-4 h-4", syncMutation.isPending && "animate-spin")} />
          Sync Products from Orders
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search by SKU or name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Tag}
          title="No products found"
          description={search ? "Try a different search term." : "Use 'Sync Products from Orders' to create product stubs from your imported order data."}
        />
      ) : (
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">SKU</th>
                <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Cost</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Sale Price</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Reorder Pt</th>
                <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Weight (g)</th>
                <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-20">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map(p => {
                const isEditing = editing?.id === p.id;
                return (
                  <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors", isEditing && "bg-primary/5")}>
                    <td className="px-4 py-2.5 font-mono text-xs text-foreground">{p.sku}</td>
                    <td className="px-4 py-2.5">
                      {isEditing ? (
                        <Input
                          value={editing.name}
                          onChange={e => setEditing({ ...editing, name: e.target.value })}
                          className="h-7 text-sm"
                        />
                      ) : (
                        <span className={cn(p.name === p.sku && "text-muted-foreground italic")}>{p.name}</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <Input
                          value={editing.unit_cost}
                          onChange={e => setEditing({ ...editing, unit_cost: e.target.value })}
                          className="h-7 text-sm text-right w-24 ml-auto"
                          placeholder="0.00"
                        />
                      ) : (
                        p.unit_cost != null ? `$${Number(p.unit_cost).toFixed(2)}` : <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <Input
                          value={editing.sale_price}
                          onChange={e => setEditing({ ...editing, sale_price: e.target.value })}
                          className="h-7 text-sm text-right w-24 ml-auto"
                          placeholder="0.00"
                        />
                      ) : (
                        p.sale_price != null ? `$${Number(p.sale_price).toFixed(2)}` : <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <Input
                          value={editing.reorder_point}
                          onChange={e => setEditing({ ...editing, reorder_point: e.target.value })}
                          className="h-7 text-sm text-right w-20 ml-auto"
                          placeholder="0"
                        />
                      ) : (
                        p.reorder_point
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {isEditing ? (
                        <Input
                          value={editing.weight_grams}
                          onChange={e => setEditing({ ...editing, weight_grams: e.target.value })}
                          className="h-7 text-sm text-right w-20 ml-auto"
                          placeholder="—"
                        />
                      ) : (
                        p.weight_grams != null ? p.weight_grams : <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={saveEdit} className="p-1 rounded hover:bg-primary/10 text-primary" title="Save">
                            <Save className="w-4 h-4" />
                          </button>
                          <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Cancel">
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import { useState, useMemo, useCallback } from "react";
import skuFrameworkUrl from "@/assets/JFlowers_SKU_Framework_v12.xlsx?url";
import { useProducts, useImportSkuFramework } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import KpiCard from "@/components/KpiCard";
import { Tag, Search, Upload, Plus, Save, X, Pencil, ChevronRight, ChevronDown, Package, Minus, Layers, Crosshair, Swords, Briefcase, Gem, Shirt, LayoutGrid, Trash2 } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { readFileAsArrayBuffer } from "@/lib/csvParsers";
import type { Product } from "@/types/database";

type EditingRow = {
  id: string;
  name: string;
  description: string;
};

type TabConfig = {
  key: string;
  label: string;
  categories: string[];
  hierarchical: boolean;
  columns: { key: string; label: string }[];
};

const TABS: TabConfig[] = [
  {
  key: 'shafts', label: 'Shafts', categories: ['shaft'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Model' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'playing_cues', label: 'Playing Cues', categories: ['playing_cue'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Model' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'break_jump', label: 'Break & Jump', categories: ['break_cue', 'jump_cue', 'break_jump'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'cases', label: 'Cases', categories: ['case'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'accessories', label: 'Accessories', categories: ['accessory'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'apparel', label: 'Apparel', categories: ['apparel'], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Design' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'all', label: 'All', categories: [], hierarchical: true,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'category', label: 'Category' },
      { key: 'row_type', label: 'Type' },
    ],
  },
];

const CATEGORY_LABELS: Record<string, string> = {
  shaft: 'Shaft', playing_cue: 'Playing Cue', break_cue: 'Break Cue',
  jump_cue: 'Jump Cue', break_jump: 'Break+Jump', case: 'Case',
  accessory: 'Accessory', apparel: 'Apparel',
};

type FilterKey = 'overview' | string;

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterKey>("overview");
  const [channelFilter, setChannelFilter] = useState<"all" | "JF" | "DL">("all");
  const [editing, setEditing] = useState<EditingRow | null>(null);
  const [expandedParents, setExpandedParents] = useState<Set<string>>(new Set());
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newProduct, setNewProduct] = useState({ sku: '', name: '', description: '', parentId: '' });

  const { currentCompany } = useCompany();
  const { data: products = [], isLoading } = useProducts();
  const importMutation = useImportSkuFramework();
  const queryClient = useQueryClient();

  // Group products by category
  const productsByCategory = useMemo(() => {
    const map: Record<string, Product[]> = {};
    for (const p of products) {
      const cat = p.category || 'other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(p);
    }
    return map;
  }, [products]);

  // KPI counts
  const counts = useMemo(() => ({
    total: products.length,
    shafts: products.filter(p => p.category === 'shaft').length,
    playingCues: products.filter(p => p.category === 'playing_cue').length,
    breakJump: products.filter(p => ['break_cue', 'jump_cue', 'break_jump'].includes(p.category || '')).length,
    cases: products.filter(p => p.category === 'case').length,
    accessories: products.filter(p => p.category === 'accessory').length,
    apparel: products.filter(p => p.category === 'apparel').length,
  }), [products]);

  // Get filtered products for current tab
  const getTabProducts = useCallback((tab: TabConfig) => {
    let list: Product[];
    if (tab.categories.length === 0) {
      list = products;
    } else {
      list = tab.categories.flatMap(c => productsByCategory[c] || []);
    }
    // Channel filter for Playing Cues
    if (tab.key === 'playing_cues' && channelFilter !== 'all') {
      const prefix = channelFilter + '-';
      list = list.filter(p => p.sku.startsWith(prefix));
    }
    if (search) {
      const s = search.toLowerCase();
      list = list.filter(p =>
        p.sku.toLowerCase().includes(s) ||
        p.name.toLowerCase().includes(s) ||
        (p.description || '').toLowerCase().includes(s)
      );
    }
    return list;
  }, [products, productsByCategory, search, channelFilter]);

  const toggleParent = (id: string) => {
    setExpandedParents(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx,.xls';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const buffer = await readFileAsArrayBuffer(file);
        const result = await importMutation.mutateAsync(buffer);
        toast.success(`Imported ${result.created} products (${result.skipped} already existed).`);
      } catch (err: any) {
        toast.error("Import failed: " + (err.message || "Unknown error"));
      }
    };
    input.click();
  };

  const handleImportBundled = async () => {
    try {
      const resp = await fetch(skuFrameworkUrl);
      const buffer = await resp.arrayBuffer();
      const result = await importMutation.mutateAsync(buffer);
      toast.success(`Imported ${result.created} products (${result.skipped} already existed).`);
    } catch (err: any) {
      toast.error("Import failed: " + (err.message || "Unknown error"));
    }
  };

  const startEdit = (p: Product) => {
    setEditing({ id: p.id, name: p.name || '', description: p.description || '' });
  };

  const saveEdit = async () => {
    if (!editing) return;
    const { error } = await (supabase as any).from("products").update({
      name: editing.name.trim() || editing.id,
      description: editing.description.trim() || null,
    }).eq("id", editing.id);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success("Product updated.");
    setEditing(null);
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const currentTab = TABS.find(t => t.key === activeFilter) || TABS[0];

  const handleAddProduct = async () => {
    if (!newProduct.sku.trim() || !newProduct.name.trim() || !currentCompany) return;
    const tab = currentTab;
    const category = tab.categories[0] || 'other';
    const row_type = newProduct.parentId ? 'variant' : (tab.hierarchical ? 'parent' : 'standalone');

    const { error } = await (supabase as any).from("products").insert({
      company_id: currentCompany.id,
      sku: newProduct.sku.trim(),
      name: newProduct.name.trim(),
      description: newProduct.description.trim() || null,
      category,
      row_type,
      parent_product_id: newProduct.parentId || null,
    });
    if (error) { toast.error("Failed: " + error.message); return; }
    toast.success("Product added.");
    setAddDialogOpen(false);
    setNewProduct({ sku: '', name: '', description: '', parentId: '' });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const parentProducts = useMemo(() => {
    if (!currentTab.hierarchical) return [];
    return currentTab.categories.flatMap(c => (productsByCategory[c] || []).filter(p => p.row_type === 'parent'));
  }, [currentTab, productsByCategory]);

  if (!currentCompany) return <EmptyState icon={Tag} title="No company selected" />;

  const handleDeleteAll = async () => {
    if (!currentCompany) return;
    const count = products.length;
    if (count === 0) { toast.info("No products to delete."); return; }
    const confirmed = window.confirm(`Delete all ${count} products? This cannot be undone.`);
    if (!confirmed) return;
    try {
      const { error } = await (supabase as any).from("products").delete().eq("company_id", currentCompany.id);
      if (error) throw error;
      toast.success(`Deleted ${count} products.`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    } catch (err: any) {
      toast.error("Delete failed: " + (err.message || "Unknown error"));
    }
  };

  const renderTable = (tab: TabConfig) => {
    const tabProducts = getTabProducts(tab);
    if (tabProducts.length === 0) {
      return (
        <EmptyState
          icon={Tag}
          title="No products found"
          description={search ? "Try a different search term." : "Import your SKU Framework to populate the catalog."}
        />
      );
    }

    if (tab.hierarchical) {
      return renderHierarchicalTable(tab, tabProducts);
    }
    return renderFlatTable(tab, tabProducts);
  };

  const renderFlatTable = (tab: TabConfig, items: Product[]) => (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
              {tab.columns.map(col => (
                <th key={col.key} className="text-left py-3 px-4">{col.label}</th>
              ))}
              <th className="text-center py-3 px-4 w-20">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(p => renderRow(p, tab))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderHierarchicalTable = (tab: TabConfig, items: Product[]) => {
    const parents = items.filter(p => p.row_type === 'parent');
    const standalones = items.filter(p => p.row_type === 'standalone');
    const variants = items.filter(p => p.row_type === 'variant');
    const variantsByParent = new Map<string, Product[]>();
    const orphans: Product[] = [];

    for (const v of variants) {
      if (v.parent_product_id) {
        const list = variantsByParent.get(v.parent_product_id) || [];
        list.push(v);
        variantsByParent.set(v.parent_product_id, list);
      } else {
        orphans.push(v);
      }
    }

    return (
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="w-8"></th>
                {tab.columns.map(col => (
                  <th key={col.key} className="text-left py-3 px-4">{col.label}</th>
                ))}
                <th className="text-center py-3 px-4 w-20">Actions</th>
              </tr>
            </thead>
            <tbody>
              {parents.map(parent => {
                const childVariants = variantsByParent.get(parent.id) || [];
                const isExpanded = expandedParents.has(parent.id);
                return (
                  <ParentGroup
                    key={parent.id}
                    parent={parent}
                    variants={childVariants}
                    isExpanded={isExpanded}
                    onToggle={() => toggleParent(parent.id)}
                    tab={tab}
                    renderRow={renderRow}
                  />
                );
              })}
              {standalones.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="px-2 py-3 text-center"><Minus className="w-3 h-3 text-muted-foreground/40" /></td>
                  {renderRowCells(p, tab)}
                  <td className="py-3 px-4 text-center">{renderActions(p)}</td>
                </tr>
              ))}
              {orphans.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td></td>
                  {renderRowCells(p, tab)}
                  <td className="py-3 px-4 text-center">{renderActions(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderRowCells = (p: Product, tab: TabConfig) => {
    const isEditing = editing?.id === p.id;
    return tab.columns.map(col => {
      if (col.key === 'sku') {
        return <td key={col.key} className="py-3 px-4 font-mono text-xs text-primary">{p.sku}</td>;
      }
      if (col.key === 'name') {
        return (
          <td key={col.key} className="py-3 px-4">
            {isEditing ? (
              <Input value={editing!.name} onChange={e => setEditing({ ...editing!, name: e.target.value })} className="h-7 text-sm" />
            ) : (
              <span className={cn("text-foreground", p.name === p.sku && "text-muted-foreground italic")}>{p.name}</span>
            )}
          </td>
        );
      }
      if (col.key === 'description') {
        return (
          <td key={col.key} className="py-3 px-4 text-muted-foreground text-xs max-w-[300px] truncate">
            {isEditing ? (
              <Input value={editing!.description} onChange={e => setEditing({ ...editing!, description: e.target.value })} className="h-7 text-sm" />
            ) : (
              p.description || '—'
            )}
          </td>
        );
      }
      if (col.key === 'category') {
        return <td key={col.key} className="py-3 px-4"><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[p.category || ''] || p.category || '—'}</Badge></td>;
      }
      if (col.key === 'row_type') {
        return (
          <td key={col.key} className="py-3 px-4">
            <Badge variant={p.row_type === 'parent' ? 'default' : p.row_type === 'variant' ? 'secondary' : 'outline'} className="text-xs">
              {p.row_type}
            </Badge>
          </td>
        );
      }
      return <td key={col.key} className="py-3 px-4">—</td>;
    });
  };

  const renderActions = (p: Product) => {
    const isEditing = editing?.id === p.id;
    if (isEditing) {
      return (
        <div className="flex items-center justify-center gap-1">
          <button onClick={saveEdit} className="p-1 rounded hover:bg-primary/10 text-primary" title="Save"><Save className="w-4 h-4" /></button>
          <button onClick={() => setEditing(null)} className="p-1 rounded hover:bg-destructive/10 text-destructive" title="Cancel"><X className="w-4 h-4" /></button>
        </div>
      );
    }
    return (
      <button onClick={() => startEdit(p)} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
        <Pencil className="w-3.5 h-3.5" />
      </button>
    );
  };

  const renderRow = (p: Product, tab: TabConfig) => {
    const isEditing = editing?.id === p.id;
    return (
      <tr key={p.id} className={cn("border-b border-border/50 hover:bg-muted/20 transition-colors", isEditing && "bg-primary/5")}>
        {renderRowCells(p, tab)}
        <td className="py-3 px-4 text-center">{renderActions(p)}</td>
      </tr>
    );
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Product Catalog</h1>
        <p className="text-sm text-muted-foreground">{products.length} products · SKU framework & catalogue management</p>
      </div>

      {/* KPI row — clickable cards navigate to category tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { key: 'all', title: 'All SKUs', value: counts.total, icon: LayoutGrid, variant: 'info' as const },
          { key: 'shafts', title: 'Shafts', value: counts.shafts, icon: Crosshair, variant: 'warning' as const },
          { key: 'playing_cues', title: 'Playing Cues', value: counts.playingCues, icon: Swords, variant: 'success' as const },
          { key: 'break_jump', title: 'Break & Jump', value: counts.breakJump, icon: Layers, variant: 'danger' as const },
          { key: 'cases', title: 'Cases', value: counts.cases, icon: Briefcase, variant: 'default' as const },
          { key: 'accessories', title: 'Accessories', value: counts.accessories, icon: Gem, variant: 'info' as const },
          { key: 'apparel', title: 'Apparel', value: counts.apparel, icon: Shirt, variant: 'warning' as const },
          { key: 'overview', title: 'Categories', value: Object.keys(productsByCategory).length, icon: Tag, variant: 'success' as const },
        ].map(card => {
          const ringColorMap: Record<string, string> = {
            default: 'ring-muted-foreground',
            success: 'ring-success',
            warning: 'ring-warning',
            danger: 'ring-destructive',
            info: 'ring-info',
          };
          const ringColor = ringColorMap[card.variant] || 'ring-primary';
          return (
            <button
              key={card.key}
              onClick={() => setActiveFilter(card.key)}
              className={cn("text-left rounded-lg transition-all", activeFilter === card.key && `ring-2 ${ringColor} ring-offset-2 ring-offset-background`)}
            >
              <KpiCard title={card.title} value={card.value} icon={card.icon} variant={card.variant} />
            </button>
          );
        })}
      </div>

      {/* Search + Import on one line */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by SKU, name, or details…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        <button
          onClick={handleImport}
          disabled={importMutation.isPending}
          className="px-3 py-2 rounded-md text-xs font-medium transition-colors border border-border bg-card text-muted-foreground hover:bg-muted flex items-center gap-1.5 whitespace-nowrap"
        >
          <Upload className={cn("w-3.5 h-3.5", importMutation.isPending && "animate-spin")} />
          Import SKU Framework
        </button>
        {products.length === 0 && (
          <button
            onClick={handleImportBundled}
            disabled={importMutation.isPending}
            className="px-3 py-2 rounded-md text-xs font-medium transition-colors border border-primary/50 bg-card text-primary hover:bg-primary/10 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Package className={cn("w-3.5 h-3.5", importMutation.isPending && "animate-spin")} />
            Import v5 (Bundled)
          </button>
        )}
        {products.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="px-3 py-2 rounded-md text-xs font-medium transition-colors border border-destructive/50 bg-card text-destructive hover:bg-destructive/10 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete All
          </button>
        )}
        {activeFilter !== 'overview' && activeFilter !== 'all' && (
          <button
            onClick={() => setAddDialogOpen(true)}
            className="px-3 py-2 rounded-md text-xs font-medium transition-colors border border-primary bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Product
          </button>
        )}
      </div>

      {/* Channel filter for Playing Cues */}
      {activeFilter === 'playing_cues' && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Channel:</span>
          <ToggleGroup type="single" value={channelFilter} onValueChange={(v) => v && setChannelFilter(v as "all" | "JF" | "DL")} size="sm" variant="outline">
            <ToggleGroupItem value="all" className="text-xs px-3">All</ToggleGroupItem>
            <ToggleGroupItem value="JF" className="text-xs px-3">JF (B2C)</ToggleGroupItem>
            <ToggleGroupItem value="DL" className="text-xs px-3">DL (Dealer)</ToggleGroupItem>
          </ToggleGroup>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner message="Loading products..." />
      ) : activeFilter === 'overview' ? (
        <OverviewTab productsByCategory={productsByCategory} />
      ) : (
        (() => {
          const tab = TABS.find(t => t.key === activeFilter);
          return tab ? renderTable(tab) : null;
        })()
      )}

      {/* Add Product Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Product — {currentTab.label}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>SKU</Label>
              <Input value={newProduct.sku} onChange={e => setNewProduct(p => ({ ...p, sku: e.target.value }))} placeholder="e.g. PC-ASP-JF1010-NW" />
            </div>
            <div>
              <Label>Name</Label>
              <Input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} placeholder="Product name" />
            </div>
            <div>
              <Label>Description</Label>
              <Input value={newProduct.description} onChange={e => setNewProduct(p => ({ ...p, description: e.target.value }))} placeholder="Optional details" />
            </div>
            {currentTab.hierarchical && (
              <div>
                <Label>Parent Product (leave empty for new parent)</Label>
                <Select value={newProduct.parentId} onValueChange={v => setNewProduct(p => ({ ...p, parentId: v === '__none__' ? '' : v }))}>
                  <SelectTrigger><SelectValue placeholder="None (this is a parent)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None (new parent)</SelectItem>
                    {parentProducts.map(pp => (
                      <SelectItem key={pp.id} value={pp.id}>{pp.sku} — {pp.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleAddProduct} disabled={!newProduct.sku.trim() || !newProduct.name.trim()}>Add Product</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Sub-component for collapsible parent/variant groups
function ParentGroup({
  parent, variants, isExpanded, onToggle, tab, renderRow,
}: {
  parent: Product;
  variants: Product[];
  isExpanded: boolean;
  onToggle: () => void;
  tab: TabConfig;
  renderRow: (p: Product, tab: TabConfig) => JSX.Element;
}) {
  return (
    <>
      <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors font-semibold cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-3 text-center">
          {variants.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : <span className="w-4 h-4 inline-block" />}
        </td>
        <td className="py-3 px-4 font-mono text-xs text-primary">{parent.sku}</td>
        <td className="py-3 px-4 text-foreground">
          {parent.name}
        </td>
        {tab.columns.slice(2).map(col => (
          <td key={col.key} className="py-3 px-4 text-muted-foreground text-xs">{parent.description || '—'}</td>
        ))}
        <td className="py-3 px-4 text-center">
          <button onClick={e => { e.stopPropagation(); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {isExpanded && variants.map(v => (
        <tr key={v.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors bg-muted/10">
          <td></td>
          <td className="py-3 px-4 pl-8 font-mono text-xs text-muted-foreground">{v.sku}</td>
          <td className="py-3 px-4 text-muted-foreground text-sm">{v.name}</td>
          {tab.columns.slice(2).map(col => (
            <td key={col.key} className="py-3 px-4 text-muted-foreground text-xs">{v.description || '—'}</td>
          ))}
          <td className="py-3 px-4 text-center">
            <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </td>
        </tr>
      ))}
    </>
  );
}

const SKU_STRUCTURE = [
  { prefix: 'PC-', label: 'Playing Cues', pattern: 'PC-[TIER]-[MODEL]-[WRAP]', example: 'PC-ASP-JF2003BF-NW', hierarchy: 'Parent (no wrap) + wrap variants' },
  { prefix: 'BK-', label: 'Break Cues', pattern: 'BK-BRK-[MODEL]-[WRAP]', example: 'BK-BRK-BRKR-RED-NW', hierarchy: 'Flat (standalone)' },
  { prefix: 'JP-', label: 'Jump Cues', pattern: 'JP-JMP-[MODEL]-[WRAP]', example: 'JP-JMP-RPG-NW', hierarchy: 'Flat (standalone)' },
  { prefix: 'BJ-', label: 'Break+Jump', pattern: 'BJ-BRJ-[MODEL]-[WRAP]', example: 'BJ-BRJ-BJ2-STD', hierarchy: 'Flat (standalone)' },
  { prefix: 'SH-', label: 'Shafts', pattern: 'SH-[TYPE]-[MODEL]-[JOINT]-[TIP]', example: 'SH-CF-CROWN-RAD-125', hierarchy: 'Flat (standalone)' },
  { prefix: 'CS-', label: 'Cue Cases', pattern: 'CS-[TYPE]-[MODEL]-[COLOUR]-[SIZE]', example: 'CS-HC-TUFF-BRN-3X6', hierarchy: 'Flat (standalone)' },
  { prefix: 'ACC-', label: 'Accessories', pattern: 'ACC-[SUBCAT]-[MODEL]-[VAR]', example: 'ACC-EXT-3IN', hierarchy: 'Flat (standalone)' },
  { prefix: 'APP-', label: 'Apparel', pattern: 'APP-[TYPE]-[DESIGN]-[SIZE]', example: 'APP-MJ-PATRIOT-USA-XL', hierarchy: 'Size=PARENT → parent, else variant' },
];

function OverviewTab({ productsByCategory }: { productsByCategory: Record<string, Product[]> }) {
  return (
    <div className="space-y-6">

      {/* SKU Framework Reference */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">SKU Framework Reference</h2>
          <p className="text-xs text-muted-foreground mt-0.5">JFlowers SKU Framework v3.0 — Dealership Channel — March 2026</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">Prefix</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">Pattern</th>
                <th className="text-left py-3 px-4">Example</th>
                <th className="text-left py-3 px-4">Hierarchy</th>
              </tr>
            </thead>
            <tbody>
              {SKU_STRUCTURE.map(row => (
                <tr key={row.prefix} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs font-semibold text-primary">{row.prefix}</td>
                  <td className="py-3 px-4 font-medium text-foreground">{row.label}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{row.pattern}</td>
                  <td className="py-3 px-4 font-mono text-xs text-foreground">{row.example}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{row.hierarchy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row type legend */}
      <div className="bg-card border border-border rounded-lg p-4">
        <h3 className="font-semibold text-foreground text-sm mb-3">Row Types</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-start gap-2">
            <Badge variant="default" className="text-xs mt-0.5">parent</Badge>
            <p className="text-xs text-muted-foreground">Base model without size/wrap variant. Groups child variants underneath.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="secondary" className="text-xs mt-0.5">variant</Badge>
            <p className="text-xs text-muted-foreground">Specific wrap, size, or colour of a parent. Linked via parent_product_id.</p>
          </div>
          <div className="flex items-start gap-2">
            <Badge variant="outline" className="text-xs mt-0.5">standalone</Badge>
            <p className="text-xs text-muted-foreground">Single SKU with no parent/child relationship. Most shafts, cases, accessories.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

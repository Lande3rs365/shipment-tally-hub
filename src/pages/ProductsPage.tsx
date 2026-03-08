import { useState, useMemo, useCallback } from "react";
import { useProducts, useImportSkuFramework } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import LoadingSpinner from "@/components/LoadingSpinner";
import EmptyState from "@/components/EmptyState";
import { Tag, Search, Upload, Plus, Save, X, Pencil, ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
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
    key: 'shafts', label: 'Shafts', categories: ['shaft'], hierarchical: false,
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
    key: 'break_jump', label: 'Break & Jump', categories: ['break_cue', 'jump_cue', 'break_jump'], hierarchical: false,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'cases', label: 'Cases', categories: ['case'], hierarchical: false,
    columns: [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Name' },
      { key: 'description', label: 'Details' },
    ],
  },
  {
    key: 'accessories', label: 'Accessories', categories: ['accessory'], hierarchical: false,
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
    key: 'all', label: 'All', categories: [], hierarchical: false,
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

export default function ProductsPage() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("overview");
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

  // Get filtered products for current tab
  const getTabProducts = useCallback((tab: TabConfig) => {
    let list: Product[];
    if (tab.categories.length === 0) {
      list = products;
    } else {
      list = tab.categories.flatMap(c => productsByCategory[c] || []);
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
  }, [products, productsByCategory, search]);

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

  const currentTab = TABS.find(t => t.key === activeTab) || TABS[0];

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

  if (isLoading) return <LoadingSpinner />;

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
    <div className="border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {tab.columns.map(col => (
              <th key={col.key} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{col.label}</th>
            ))}
            <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-20">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {items.map(p => renderRow(p, tab))}
        </tbody>
      </table>
    </div>
  );

  const renderHierarchicalTable = (tab: TabConfig, items: Product[]) => {
    const parents = items.filter(p => p.row_type === 'parent');
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
      <div className="border border-border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="w-8"></th>
              {tab.columns.map(col => (
                <th key={col.key} className="text-left px-4 py-2.5 font-medium text-muted-foreground">{col.label}</th>
              ))}
              <th className="text-center px-4 py-2.5 font-medium text-muted-foreground w-20">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
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
            {orphans.map(p => (
              <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                <td></td>
                {renderRowCells(p, tab)}
                <td className="px-4 py-2.5 text-center">{renderActions(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderRowCells = (p: Product, tab: TabConfig) => {
    const isEditing = editing?.id === p.id;
    return tab.columns.map(col => {
      if (col.key === 'sku') {
        return <td key={col.key} className="px-4 py-2.5 font-mono text-xs text-foreground">{p.sku}</td>;
      }
      if (col.key === 'name') {
        return (
          <td key={col.key} className="px-4 py-2.5">
            {isEditing ? (
              <Input value={editing!.name} onChange={e => setEditing({ ...editing!, name: e.target.value })} className="h-7 text-sm" />
            ) : (
              <span className={cn(p.name === p.sku && "text-muted-foreground italic")}>{p.name}</span>
            )}
          </td>
        );
      }
      if (col.key === 'description') {
        return (
          <td key={col.key} className="px-4 py-2.5 text-muted-foreground text-xs max-w-[300px] truncate">
            {isEditing ? (
              <Input value={editing!.description} onChange={e => setEditing({ ...editing!, description: e.target.value })} className="h-7 text-sm" />
            ) : (
              p.description || '—'
            )}
          </td>
        );
      }
      if (col.key === 'category') {
        return <td key={col.key} className="px-4 py-2.5"><Badge variant="outline" className="text-xs">{CATEGORY_LABELS[p.category || ''] || p.category || '—'}</Badge></td>;
      }
      if (col.key === 'row_type') {
        return (
          <td key={col.key} className="px-4 py-2.5">
            <Badge variant={p.row_type === 'parent' ? 'default' : p.row_type === 'variant' ? 'secondary' : 'outline'} className="text-xs">
              {p.row_type}
            </Badge>
          </td>
        );
      }
      return <td key={col.key} className="px-4 py-2.5">—</td>;
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
      <tr key={p.id} className={cn("hover:bg-muted/30 transition-colors", isEditing && "bg-primary/5")}>
        {renderRowCells(p, tab)}
        <td className="px-4 py-2.5 text-center">{renderActions(p)}</td>
      </tr>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Tag className="w-5 h-5 text-primary" /> Product Catalog
          </h1>
          <p className="text-sm text-muted-foreground">{products.length} products</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport} disabled={importMutation.isPending}>
            <Upload className={cn("w-4 h-4 mr-1", importMutation.isPending && "animate-spin")} />
            Import SKU Framework
          </Button>
          {activeTab !== 'all' && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add Product
            </Button>
          )}
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search by SKU, name, or details…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
          {TABS.map(tab => {
            const count = getTabProducts(tab).length;
            return (
              <TabsTrigger key={tab.key} value={tab.key} className="text-xs">
                {tab.label}
                <Badge variant="secondary" className="ml-1.5 text-[10px] px-1.5 py-0">{count}</Badge>
              </TabsTrigger>
            );
          })}
        </TabsList>
        <TabsContent value="overview">
          <OverviewTab totalProducts={products.length} productsByCategory={productsByCategory} />
        </TabsContent>
        {TABS.map(tab => (
          <TabsContent key={tab.key} value={tab.key}>
            {renderTable(tab)}
          </TabsContent>
        ))}
      </Tabs>

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
      <tr className="hover:bg-muted/30 transition-colors font-semibold cursor-pointer" onClick={onToggle}>
        <td className="px-2 py-2.5 text-center">
          {variants.length > 0 ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
          ) : <span className="w-4 h-4 inline-block" />}
        </td>
        <td className="px-4 py-2.5 font-mono text-xs text-foreground">{parent.sku}</td>
        <td className="px-4 py-2.5">
          {parent.name}
          {variants.length > 0 && (
            <Badge variant="secondary" className="ml-2 text-[10px]">{variants.length} variant{variants.length !== 1 ? 's' : ''}</Badge>
          )}
        </td>
        {tab.columns.slice(2).map(col => (
          <td key={col.key} className="px-4 py-2.5 text-muted-foreground text-xs">{parent.description || '—'}</td>
        ))}
        <td className="px-4 py-2.5 text-center">
          <button onClick={e => { e.stopPropagation(); }} className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground" title="Edit">
            <Pencil className="w-3.5 h-3.5" />
          </button>
        </td>
      </tr>
      {isExpanded && variants.map(v => (
        <tr key={v.id} className="hover:bg-muted/30 transition-colors bg-muted/10">
          <td></td>
          <td className="px-4 py-2 pl-8 font-mono text-xs text-muted-foreground">{v.sku}</td>
          <td className="px-4 py-2 text-muted-foreground text-sm">{v.name}</td>
          {tab.columns.slice(2).map(col => (
            <td key={col.key} className="px-4 py-2 text-muted-foreground text-xs">{v.description || '—'}</td>
          ))}
          <td className="px-4 py-2 text-center">
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
  { prefix: 'SH-', label: 'Shafts', pattern: 'SH-{Material}-{Joint}-{Model}-{TipSize}', example: 'SH-CF-CL-RAD-125', hierarchy: 'Flat (standalone)' },
  { prefix: 'PC-', label: 'Playing Cues', pattern: 'PC-{Tier}-{Model}[-{Wrap}]', example: 'PC-ASP-JF1010-NW', hierarchy: '3 segments = parent, 4 = variant' },
  { prefix: 'BK-/JP-/BJ-', label: 'Break & Jump', pattern: 'BK-{Model}[-{Wrap}]', example: 'BK-JF-THUNDER-NW', hierarchy: 'Flat (standalone)' },
  { prefix: 'CS-', label: 'Cases', pattern: 'CS-{Type}-{Model}-{Colour}-{Size}', example: 'CS-HC-CLASSIC-BLK-2X4', hierarchy: 'Flat (standalone)' },
  { prefix: 'ACC-', label: 'Accessories', pattern: 'ACC-{SubCat}-{Item}[-{Variant}]', example: 'ACC-TIP-ULTRASKIN-M', hierarchy: 'Flat (standalone)' },
  { prefix: 'APP-', label: 'Apparel', pattern: 'APP-{Gender}-{Design}[-{Size}]', example: 'APP-MJ-PATRIOT-USA-S', hierarchy: 'Size=PARENT → parent, else variant' },
];

function OverviewTab({ totalProducts, productsByCategory }: { totalProducts: number; productsByCategory: Record<string, Product[]> }) {
  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-2xl font-bold text-foreground">{totalProducts}</p>
          <p className="text-xs text-muted-foreground">Total Products</p>
        </div>
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
          const count = (productsByCategory[key] || []).length;
          if (count === 0) return null;
          return (
            <div key={key} className="rounded-lg border border-border bg-card p-4">
              <p className="text-2xl font-bold text-foreground">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          );
        })}
      </div>

      {/* SKU Framework Reference */}
      <div className="rounded-lg border border-border bg-card">
        <div className="px-4 py-3 border-b border-border">
          <h2 className="font-semibold text-foreground">SKU Framework Reference</h2>
          <p className="text-xs text-muted-foreground mt-0.5">JFlowers SKU structure v4.0 — how product codes are constructed</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Prefix</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Category</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Pattern</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Example</th>
                <th className="text-left px-4 py-2 font-medium text-muted-foreground">Hierarchy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {SKU_STRUCTURE.map(row => (
                <tr key={row.prefix} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-2.5 font-mono text-xs font-semibold text-primary">{row.prefix}</td>
                  <td className="px-4 py-2.5 font-medium text-foreground">{row.label}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{row.pattern}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-foreground">{row.example}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{row.hierarchy}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Row type legend */}
      <div className="rounded-lg border border-border bg-card p-4">
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

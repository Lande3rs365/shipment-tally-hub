import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useStockMovements, useProducts } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import KpiCard from "@/components/KpiCard";
import {
  ArrowDownLeft, ArrowUpRight, RefreshCw, SlidersHorizontal,
  Search, ArrowRightLeft, Plus, PackagePlus, PackageMinus
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type DirFilter = 'ALL' | 'IN' | 'OUT' | 'MOVE' | 'ADJUST';
type AdjCategory = 'stock-in' | 'stock-out' | 'neutral';

const directionIcon: Record<string, JSX.Element> = {
  IN: <ArrowDownLeft className="w-3.5 h-3.5 text-success" />,
  OUT: <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />,
  MOVE: <RefreshCw className="w-3.5 h-3.5 text-info" />,
  ADJUST: <SlidersHorizontal className="w-3.5 h-3.5 text-warning" />,
};

const reasonCodes: Record<AdjCategory, string[]> = {
  'stock-in': ['Restock', 'Supplier replenishment', 'Return received', 'Inventory correction up', 'Replacement stock received'],
  'stock-out': ['Defective', 'Damaged in warehouse', 'Lost / missing', 'Sample use', 'Internal use', 'Write-off', 'Replacement sent', 'Inventory correction down'],
  'neutral': ['Reallocation', 'Warehouse transfer', 'SKU correction', 'Status correction', 'Move to quarantine', 'Release from quarantine'],
};

const catToDirection: Record<AdjCategory, string> = {
  'stock-in': 'IN',
  'stock-out': 'OUT',
  'neutral': 'ADJUST',
};

function formatType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function StockMovementsPage() {
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<DirFilter>('ALL');
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [form, setForm] = useState({ productId: '', category: 'stock-in' as AdjCategory, reason: '', quantity: 1, notes: '' });

  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: movements = [], isLoading } = useStockMovements();
  const { data: products = [] } = useProducts();

  const filtered = movements
    .filter(m => dirFilter === 'ALL' || m.direction === dirFilter)
    .filter(m =>
      (m.sku || '').toLowerCase().includes(search.toLowerCase()) ||
      ((m as any).products?.name || '').toLowerCase().includes(search.toLowerCase()) ||
      m.movement_type.toLowerCase().includes(search.toLowerCase()) ||
      (m.reason_code || '').toLowerCase().includes(search.toLowerCase())
    );

  const counts = {
    IN: movements.filter(m => m.direction === 'IN').length,
    OUT: movements.filter(m => m.direction === 'OUT').length,
    MOVE: movements.filter(m => m.direction === 'MOVE').length,
    ADJUST: movements.filter(m => m.direction === 'ADJUST').length,
  };

  const handleAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    const product = products.find(p => p.id === form.productId);

    try {
      const { error } = await supabase.from('stock_movements').insert({
        company_id: currentCompany.id,
        product_id: form.productId,
        sku: product?.sku || null,
        direction: catToDirection[form.category],
        movement_type: `manual_${form.reason.toLowerCase().replace(/\s+/g, '_')}`,
        quantity: form.quantity,
        reason_code: form.reason,
        notes: form.notes || null,
        performed_by: user?.id || null,
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setForm({ productId: '', category: 'stock-in', reason: '', quantity: 1, notes: '' });
      setShowAdjForm(false);
    } catch {
      toast.error('Failed to save adjustment');
    }
  };

  if (!currentCompany) return <EmptyState icon={ArrowRightLeft} title="No company selected" />;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Stock Ledger</h1>
          <p className="text-sm text-muted-foreground">{movements.length} movements recorded · Auditable stock history</p>
        </div>
        <Button onClick={() => setShowAdjForm(!showAdjForm)} size="sm">
          <Plus className="w-4 h-4" /> New Adjustment
        </Button>
      </div>

      {/* Adjustment Form */}
      {showAdjForm && (
        <form onSubmit={handleAdjustment} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            Manual Stock Adjustment
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Product</label>
              <select
                value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select product...</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Category</label>
              <select
                value={form.category} onChange={e => setForm({ ...form, category: e.target.value as AdjCategory, reason: '' })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="stock-in">Stock In</option>
                <option value="stock-out">Stock Out</option>
                <option value="neutral">Neutral / Transfer</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Reason Code</label>
              <select
                value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select reason...</option>
                {reasonCodes[form.category].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</label>
              <input type="number" min={1} value={form.quantity}
                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                required className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
              <input type="text" placeholder="Optional notes..." value={form.notes}
                onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowAdjForm(false)}>Cancel</Button>
            <Button type="submit">Submit Adjustment</Button>
          </div>
        </form>
      )}

      {/* Direction filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['ALL', 'IN', 'OUT', 'MOVE', 'ADJUST'] as const).map(d => (
          <button
            key={d}
            onClick={() => setDirFilter(d)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              dirFilter === d
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {d === 'ALL' ? `All (${movements.length})` : `${d} (${counts[d]})`}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search SKU, product, type..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? <LoadingSpinner message="Loading movements..." /> : filtered.length === 0 ? (
        <EmptyState icon={ArrowRightLeft} title="No stock movements" description="Movements will appear here as inventory changes are recorded." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Time</th>
                  <th className="text-left py-3 px-4">Dir</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-right py-3 px-4">Qty</th>
                  <th className="text-left py-3 px-4">Reason</th>
                  <th className="text-left py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                      {new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1 text-xs font-medium">
                        {directionIcon[m.direction]} {m.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-foreground text-xs">{formatType(m.movement_type)}</td>
                    <td className="py-3 px-4 font-mono text-primary font-medium">{m.sku || '—'}</td>
                    <td className="py-3 px-4 text-foreground">{(m as any).products?.name || '—'}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                      {m.direction === 'OUT' ? `-${m.quantity}` : m.direction === 'IN' ? `+${m.quantity}` : m.quantity}
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{m.reason_code || '—'}</td>
                    <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

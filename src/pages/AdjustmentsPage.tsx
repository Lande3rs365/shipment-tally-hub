import { useProducts } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";
import { useState } from "react";
import { Plus, PackagePlus, PackageMinus, ArrowLeftRight, SlidersHorizontal } from "lucide-react";
import { useStockMovements } from "@/hooks/useSupabaseData";
import LoadingSpinner from "@/components/LoadingSpinner";

type AdjCategory = 'stock-in' | 'stock-out' | 'neutral';

const reasonCodes: Record<AdjCategory, string[]> = {
  'stock-in': ['Restock', 'Supplier replenishment', 'Return received', 'Inventory correction up', 'Replacement stock received'],
  'stock-out': ['Defective', 'Damaged in warehouse', 'Lost / missing', 'Sample use', 'Internal use', 'Write-off', 'Replacement sent', 'Inventory correction down'],
  'neutral': ['Reallocation', 'Warehouse transfer', 'SKU correction', 'Status correction', 'Move to quarantine', 'Release from quarantine'],
};

const catIcons: Record<AdjCategory, JSX.Element> = {
  'stock-in': <PackagePlus className="w-4 h-4 text-success" />,
  'stock-out': <PackageMinus className="w-4 h-4 text-destructive" />,
  'neutral': <ArrowLeftRight className="w-4 h-4 text-info" />,
};

const catToDirection: Record<AdjCategory, string> = {
  'stock-in': 'IN',
  'stock-out': 'OUT',
  'neutral': 'ADJUST',
};

export default function AdjustmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ productId: '', category: 'stock-in' as AdjCategory, reason: '', quantity: 1, notes: '' });
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: products = [] } = useProducts();
  const { data: movements = [], isLoading } = useStockMovements();

  // Filter to adjustment-type movements
  const adjustments = movements.filter(m => 
    m.movement_type.startsWith('adjustment') || 
    m.movement_type.startsWith('manual') ||
    ['ADJUST'].includes(m.direction)
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;
    const product = products.find(p => p.id === form.productId);

    await (supabase as any).from('stock_movements').insert({
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

    queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
    setForm({ productId: '', category: 'stock-in', reason: '', quantity: 1, notes: '' });
    setShowForm(false);
  };

  if (!currentCompany) return <EmptyState icon={SlidersHorizontal} title="No company selected" />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Manual Adjustments</h1>
          <p className="text-sm text-muted-foreground">Returns, defects, damages, corrections · Every change logged</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> New Adjustment
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Product</label>
              <select
                value={form.productId} onChange={e => setForm({ ...form, productId: e.target.value })}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select product...</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>
                ))}
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
                {reasonCodes[form.category].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Quantity</label>
              <input
                type="number" min={1} value={form.quantity}
                onChange={e => setForm({ ...form, quantity: parseInt(e.target.value) || 1 })}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
              <input
                type="text" placeholder="Optional notes..."
                value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 transition-opacity">Submit Adjustment</button>
          </div>
        </form>
      )}

      {isLoading ? <LoadingSpinner message="Loading adjustments..." /> : movements.length === 0 ? (
        <EmptyState icon={SlidersHorizontal} title="No adjustments yet" description="Manual stock adjustments will appear here." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Time</th>
                  <th className="text-left py-3 px-4">Direction</th>
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-left py-3 px-4">Type</th>
                  <th className="text-right py-3 px-4">Qty</th>
                  <th className="text-left py-3 px-4">Reason</th>
                  <th className="text-left py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {movements.map(m => (
                  <tr key={m.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                        {m.direction === 'IN' ? catIcons['stock-in'] : m.direction === 'OUT' ? catIcons['stock-out'] : catIcons['neutral']}
                        {m.direction}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono text-primary font-medium">{m.sku || '—'}</td>
                    <td className="py-3 px-4 text-foreground text-xs">{m.movement_type.replace(/_/g, ' ')}</td>
                    <td className="py-3 px-4 text-right font-mono font-medium text-foreground">{m.quantity}</td>
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

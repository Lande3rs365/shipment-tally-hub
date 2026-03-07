import { mockInventory } from "@/data/mockData";
import { useState } from "react";
import { Plus, PackagePlus, PackageMinus, ArrowLeftRight } from "lucide-react";

type AdjCategory = 'stock-in' | 'stock-out' | 'neutral';

const reasonCodes: Record<AdjCategory, string[]> = {
  'stock-in': ['Restock', 'Supplier replenishment', 'Return received', 'Inventory correction up', 'Replacement stock received'],
  'stock-out': ['Defective', 'Damaged in warehouse', 'Lost / missing', 'Sample use', 'Internal use', 'Write-off', 'Replacement sent', 'Inventory correction down'],
  'neutral': ['Reallocation', 'Warehouse transfer', 'SKU correction', 'Status correction', 'Move to quarantine', 'Release from quarantine'],
};

interface AdjustmentEntry {
  id: string;
  sku: string;
  category: AdjCategory;
  reason: string;
  quantity: number;
  notes: string;
  submittedAt: string;
  user: string;
}

// Demo log
const demoLog: AdjustmentEntry[] = [
  { id: 'ADJ-001', sku: 'VIT-D-1000', category: 'stock-out', reason: 'Defective', quantity: 5, notes: 'Batch 2026-02 QC failure', submittedAt: '2026-03-04T07:30:00Z', user: 'inv-mgr-1' },
  { id: 'ADJ-002', sku: 'ZNC-50', category: 'stock-out', reason: 'Damaged in warehouse', quantity: 2, notes: 'Dropped during restock', submittedAt: '2026-03-04T09:00:00Z', user: 'warehouse-1' },
  { id: 'ADJ-003', sku: 'VIT-C-500', category: 'stock-out', reason: 'Sample use', quantity: 3, notes: 'Marketing trade show', submittedAt: '2026-03-06T10:00:00Z', user: 'ops-user-1' },
  { id: 'ADJ-004', sku: 'COLG-TYPE2', category: 'neutral', reason: 'Move to quarantine', quantity: 3, notes: 'Customer return inspection', submittedAt: '2026-03-04T14:00:00Z', user: 'warehouse-1' },
];

const catIcons: Record<AdjCategory, JSX.Element> = {
  'stock-in': <PackagePlus className="w-4 h-4 text-success" />,
  'stock-out': <PackageMinus className="w-4 h-4 text-destructive" />,
  'neutral': <ArrowLeftRight className="w-4 h-4 text-info" />,
};

export default function AdjustmentsPage() {
  const [showForm, setShowForm] = useState(false);
  const [entries, setEntries] = useState<AdjustmentEntry[]>(demoLog);
  const [form, setForm] = useState({ sku: '', category: 'stock-in' as AdjCategory, reason: '', quantity: 1, notes: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entry: AdjustmentEntry = {
      id: `ADJ-${String(entries.length + 1).padStart(3, '0')}`,
      ...form,
      submittedAt: new Date().toISOString(),
      user: 'current-user',
    };
    setEntries([entry, ...entries]);
    setForm({ sku: '', category: 'stock-in', reason: '', quantity: 1, notes: '' });
    setShowForm(false);
  };

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
              <label className="text-xs text-muted-foreground uppercase tracking-wider">SKU</label>
              <select
                value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })}
                required
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">Select SKU...</option>
                {mockInventory.map(i => (
                  <option key={i.sku} value={i.sku}>{i.sku} — {i.productName}</option>
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

      {/* Adjustment log */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">ID</th>
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">Category</th>
                <th className="text-left py-3 px-4">SKU</th>
                <th className="text-left py-3 px-4">Reason</th>
                <th className="text-right py-3 px-4">Qty</th>
                <th className="text-left py-3 px-4">Notes</th>
                <th className="text-left py-3 px-4">User</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{e.id}</td>
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(e.submittedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium">
                      {catIcons[e.category]}
                      {e.category === 'stock-in' ? 'Stock In' : e.category === 'stock-out' ? 'Stock Out' : 'Transfer'}
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-primary font-medium">{e.sku}</td>
                  <td className="py-3 px-4 text-foreground">{e.reason}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-foreground">{e.quantity}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{e.notes || '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{e.user}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

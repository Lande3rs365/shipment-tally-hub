import { mockMovements } from "@/data/mockData";
import type { MovementDirection } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { ArrowDownLeft, ArrowUpRight, RefreshCw, SlidersHorizontal, Search } from "lucide-react";
import { useState } from "react";

const directionIcon: Record<MovementDirection, JSX.Element> = {
  IN: <ArrowDownLeft className="w-3.5 h-3.5 text-success" />,
  OUT: <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />,
  MOVE: <RefreshCw className="w-3.5 h-3.5 text-info" />,
  ADJUST: <SlidersHorizontal className="w-3.5 h-3.5 text-warning" />,
};

const directionLabel: Record<MovementDirection, string> = {
  IN: 'status-in-stock',
  OUT: 'status-out-of-stock',
  MOVE: 'status-processing',
  ADJUST: 'status-low-stock',
};

function formatType(t: string) {
  return t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export default function StockMovementsPage() {
  const [search, setSearch] = useState("");
  const [dirFilter, setDirFilter] = useState<MovementDirection | 'ALL'>('ALL');

  const filtered = mockMovements
    .filter(m => dirFilter === 'ALL' || m.direction === dirFilter)
    .filter(m =>
      m.sku.toLowerCase().includes(search.toLowerCase()) ||
      m.productName.toLowerCase().includes(search.toLowerCase()) ||
      m.movementType.toLowerCase().includes(search.toLowerCase()) ||
      (m.linkedOrderId || '').toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const counts = {
    IN: mockMovements.filter(m => m.direction === 'IN').length,
    OUT: mockMovements.filter(m => m.direction === 'OUT').length,
    MOVE: mockMovements.filter(m => m.direction === 'MOVE').length,
    ADJUST: mockMovements.filter(m => m.direction === 'ADJUST').length,
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Stock Movement Ledger</h1>
        <p className="text-sm text-muted-foreground">{mockMovements.length} movements recorded · Auditable stock history</p>
      </div>

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
            {d === 'ALL' ? `All (${mockMovements.length})` : `${d} (${counts[d]})`}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search SKU, product, type, order..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">Time</th>
                <th className="text-left py-3 px-4">Dir</th>
                <th className="text-left py-3 px-4">Type</th>
                <th className="text-left py-3 px-4">SKU</th>
                <th className="text-left py-3 px-4">Product</th>
                <th className="text-right py-3 px-4">Qty</th>
                <th className="text-left py-3 px-4">Order</th>
                <th className="text-left py-3 px-4">Source</th>
                <th className="text-left py-3 px-4">Reason</th>
                <th className="text-left py-3 px-4">User</th>
                <th className="text-left py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.movementId} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                  <td className="py-3 px-4 font-mono text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}{' '}
                    {new Date(m.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`status-badge ${directionLabel[m.direction]} inline-flex items-center gap-1`}>
                      {directionIcon[m.direction]} {m.direction}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-foreground text-xs">{formatType(m.movementType)}</td>
                  <td className="py-3 px-4 font-mono text-primary font-medium">{m.sku}</td>
                  <td className="py-3 px-4 text-foreground">{m.productName}</td>
                  <td className="py-3 px-4 text-right font-mono font-medium text-foreground">
                    {m.direction === 'OUT' ? `-${m.quantity}` : m.direction === 'IN' ? `+${m.quantity}` : m.quantity}
                  </td>
                  <td className="py-3 px-4 font-mono text-xs text-info">{m.linkedOrderId || '—'}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{m.sourceType}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{m.reasonCode}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">{m.userId}</td>
                  <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

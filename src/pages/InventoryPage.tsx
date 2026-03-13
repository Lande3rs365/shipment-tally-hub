import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useInventory, useStockMovements } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Warehouse, Search, AlertTriangle, TrendingDown, ShieldAlert } from "lucide-react";
import { useState } from "react";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const { currentCompany } = useCompany();
  const { data: inventory = [], isLoading } = useInventory();
  const { data: movements = [] } = useStockMovements();

  const totalOnHand = inventory.reduce((s, i) => s + i.on_hand, 0);
  const totalReserved = inventory.reduce((s, i) => s + i.reserved, 0);
  const totalDamaged = inventory.reduce((s, i) => s + i.damaged, 0);
  const lowCount = inventory.filter(i => {
    const threshold = i.products?.reorder_point || 0;
    return i.on_hand > 0 && i.on_hand <= threshold;
  }).length;
  const outCount = inventory.filter(i => i.on_hand === 0).length;

  const getItemMovements = (productId: string) =>
    movements.filter(m => m.product_id === productId).slice(0, 10);

  const filteredByTab = inventory.filter(i => {
    if (filter === 'all') return true;
    if (filter === 'low') return i.on_hand > 0 && i.on_hand <= (i.products?.reorder_point || 0);
    if (filter === 'out') return i.on_hand === 0;
    if (filter === 'damaged') return i.damaged > 0;
    return true;
  });

  const filtered = filteredByTab.filter(i =>
    (i.products?.sku || '').toLowerCase().includes(search.toLowerCase()) ||
    (i.products?.name || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!currentCompany) return <EmptyState icon={Warehouse} title="No company selected" />;

  const tabs = [
    { key: 'all', label: `All (${inventory.length})` },
    { key: 'low', label: `Low Stock (${lowCount})` },
    { key: 'out', label: `Out of Stock (${outCount})` },
    { key: 'damaged', label: `Damaged (${inventory.filter(i => i.damaged > 0).length})` },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Inventory Control</h1>
        <p className="text-sm text-muted-foreground">{inventory.length} records · Movement-based stock ledger</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="kpi-card before:bg-gradient-to-r before:from-success before:to-transparent">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">On Hand</p>
          <p className="text-xl font-bold font-mono text-foreground">{totalOnHand.toLocaleString()}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-info before:to-transparent">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Reserved</p>
          <p className="text-xl font-bold font-mono text-foreground">{totalReserved}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-warning before:to-transparent">
          <div className="flex items-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5 text-warning" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Low Stock</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{lowCount}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-destructive before:to-transparent">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Out of Stock</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{outCount}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-destructive/60 before:to-transparent">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-3.5 h-3.5 text-destructive" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Damaged</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalDamaged}</p>
        </div>
      </div>

      {/* Filter row: tabs + search on same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map(f => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                filter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search SKU or product..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
          Showing {filtered.length} of {inventory.length}
        </span>
      </div>

      {isLoading ? <LoadingSpinner message="Loading inventory..." /> : filtered.length === 0 ? (
        <EmptyState icon={Warehouse} title="No inventory records" description="Inventory will appear here once products and stock movements are added." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[700px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">SKU</th>
                  <th className="text-left py-3 px-4">Product</th>
                  <th className="text-left py-3 px-4">Location</th>
                  <th className="text-right py-3 px-4">On Hand</th>
                  <th className="text-right py-3 px-4">Available</th>
                  <th className="text-right py-3 px-4">Reserved</th>
                  <th className="text-right py-3 px-4">Allocated</th>
                  <th className="text-right py-3 px-4">Damaged</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const isExpanded = expandedId === item.id;
                  const itemMovements = getItemMovements(item.product_id);
                  return (
                    <>
                      <tr
                        key={item.id}
                        onClick={() => setExpandedId(isExpanded ? null : item.id)}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-primary font-medium">{item.products?.sku || '—'}</td>
                        <td className="py-3 px-4 text-foreground">{item.products?.name || '—'}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.stock_locations?.code || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-foreground">{item.on_hand}</td>
                        <td className="py-3 px-4 text-right font-mono text-foreground font-medium">{item.available}</td>
                        <td className="py-3 px-4 text-right font-mono text-info">{item.reserved || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.allocated || '—'}</td>
                        <td className="py-3 px-4 text-right font-mono text-destructive">{item.damaged || '—'}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-detail`}>
                          <td colSpan={8} className="bg-muted/10 px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Recent Stock Movements — {item.products?.sku}
                            </p>
                            {itemMovements.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No movements recorded</p>
                            ) : (
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-muted-foreground uppercase tracking-wider">
                                    <th className="text-left py-1.5 px-2">Time</th>
                                    <th className="text-left py-1.5 px-2">Dir</th>
                                    <th className="text-left py-1.5 px-2">Type</th>
                                    <th className="text-right py-1.5 px-2">Qty</th>
                                    <th className="text-left py-1.5 px-2">Notes</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {itemMovements.map(m => (
                                    <tr key={m.id} className="border-t border-border/30">
                                      <td className="py-1.5 px-2 font-mono text-muted-foreground whitespace-nowrap">
                                        {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <span className={`font-medium ${m.direction === 'IN' ? 'text-success' : m.direction === 'OUT' ? 'text-destructive' : 'text-warning'}`}>
                                          {m.direction}
                                        </span>
                                      </td>
                                      <td className="py-1.5 px-2 text-foreground">{m.movement_type.replace(/_/g, ' ')}</td>
                                      <td className="py-1.5 px-2 text-right font-mono font-medium text-foreground">
                                        {m.direction === 'OUT' ? `-${m.quantity}` : m.direction === 'IN' ? `+${m.quantity}` : m.quantity}
                                      </td>
                                      <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[180px]">{m.notes || '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

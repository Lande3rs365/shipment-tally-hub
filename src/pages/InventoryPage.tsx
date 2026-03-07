import StatusBadge from "@/components/StatusBadge";
import { mockInventory, mockMovements } from "@/data/mockData";
import { Warehouse, Search, AlertTriangle, TrendingDown, Package, ShieldAlert, RotateCcw } from "lucide-react";
import { useState } from "react";

export default function InventoryPage() {
  const [search, setSearch] = useState("");
  const [expandedSku, setExpandedSku] = useState<string | null>(null);

  const filtered = mockInventory.filter(i =>
    i.sku.toLowerCase().includes(search.toLowerCase()) ||
    i.productName.toLowerCase().includes(search.toLowerCase())
  );

  const totalStock = mockInventory.reduce((s, i) => s + i.stockOnHand, 0);
  const totalReserved = mockInventory.reduce((s, i) => s + i.reservedStock, 0);
  const totalDamaged = mockInventory.reduce((s, i) => s + i.damagedStock + i.defectiveStock, 0);
  const totalQuarantine = mockInventory.reduce((s, i) => s + i.quarantineStock, 0);
  const lowCount = mockInventory.filter(i => i.status === 'low-stock').length;
  const outCount = mockInventory.filter(i => i.status === 'out-of-stock').length;

  const getSkuMovements = (sku: string) =>
    mockMovements.filter(m => m.sku === sku).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventory Control</h1>
          <p className="text-sm text-muted-foreground">{mockInventory.length} SKUs tracked · Movement-based stock ledger</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="kpi-card before:bg-gradient-to-r before:from-success before:to-transparent">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">On Hand</p>
          <p className="text-xl font-bold font-mono text-foreground">{totalStock.toLocaleString()}</p>
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Damaged / Defect</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalDamaged}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-warning/60 before:to-transparent">
          <div className="flex items-center gap-1.5">
            <RotateCcw className="w-3.5 h-3.5 text-warning" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Quarantine</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalQuarantine}</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search SKU or product..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">SKU</th>
                <th className="text-left py-3 px-4">Product</th>
                <th className="text-right py-3 px-4">On Hand</th>
                <th className="text-right py-3 px-4">Available</th>
                <th className="text-right py-3 px-4">Reserved</th>
                <th className="text-right py-3 px-4">Allocated</th>
                <th className="text-right py-3 px-4">Shipped</th>
                <th className="text-right py-3 px-4">Returned</th>
                <th className="text-right py-3 px-4">Dmg/Def</th>
                <th className="text-right py-3 px-4">Quarantine</th>
                <th className="text-right py-3 px-4">Incoming</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Loc</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(item => {
                const movements = getSkuMovements(item.sku);
                const isExpanded = expandedSku === item.sku;
                return (
                  <>
                    <tr
                      key={item.sku}
                      onClick={() => setExpandedSku(isExpanded ? null : item.sku)}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-primary font-medium">{item.sku}</td>
                      <td className="py-3 px-4 text-foreground">{item.productName}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{item.stockOnHand}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground font-medium">{item.availableStock}</td>
                      <td className="py-3 px-4 text-right font-mono text-info">{item.reservedStock || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.allocatedStock || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.shippedQuantity}</td>
                      <td className="py-3 px-4 text-right font-mono text-muted-foreground">{item.returnedQuantity || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{(item.damagedStock + item.defectiveStock) || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-warning">{item.quarantineStock || '—'}</td>
                      <td className="py-3 px-4 text-right font-mono text-info">{item.incomingStock || '—'}</td>
                      <td className="py-3 px-4"><StatusBadge status={item.status} /></td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{item.warehouseLocation}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${item.sku}-detail`}>
                        <td colSpan={13} className="bg-muted/10 px-4 py-3">
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                              Recent Stock Movements — {item.sku}
                            </p>
                            {movements.length === 0 ? (
                              <p className="text-xs text-muted-foreground">No movements recorded</p>
                            ) : (
                              <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-muted-foreground uppercase tracking-wider">
                                      <th className="text-left py-1.5 px-2">Time</th>
                                      <th className="text-left py-1.5 px-2">Dir</th>
                                      <th className="text-left py-1.5 px-2">Type</th>
                                      <th className="text-right py-1.5 px-2">Qty</th>
                                      <th className="text-left py-1.5 px-2">Order</th>
                                      <th className="text-left py-1.5 px-2">Source</th>
                                      <th className="text-left py-1.5 px-2">Reason</th>
                                      <th className="text-left py-1.5 px-2">Notes</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {movements.slice(0, 10).map(m => (
                                      <tr key={m.movementId} className="border-t border-border/30">
                                        <td className="py-1.5 px-2 font-mono text-muted-foreground whitespace-nowrap">
                                          {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                        </td>
                                        <td className="py-1.5 px-2">
                                          <span className={`font-medium ${m.direction === 'IN' ? 'text-success' : m.direction === 'OUT' ? 'text-destructive' : 'text-warning'}`}>
                                            {m.direction}
                                          </span>
                                        </td>
                                        <td className="py-1.5 px-2 text-foreground">{m.movementType.replace(/_/g, ' ')}</td>
                                        <td className="py-1.5 px-2 text-right font-mono font-medium text-foreground">
                                          {m.direction === 'OUT' ? `-${m.quantity}` : m.direction === 'IN' ? `+${m.quantity}` : m.quantity}
                                        </td>
                                        <td className="py-1.5 px-2 font-mono text-info">{m.linkedOrderId || '—'}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground">{m.sourceType}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground">{m.reasonCode}</td>
                                        <td className="py-1.5 px-2 text-muted-foreground truncate max-w-[180px]">{m.notes || '—'}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
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
    </div>
  );
}

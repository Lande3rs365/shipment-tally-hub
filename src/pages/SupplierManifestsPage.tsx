import { mockSupplierManifests } from "@/data/mockData";
import type { InboundStatus } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Ship, Search, Package, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";

const statusFilter: (InboundStatus | 'all')[] = ['all', 'expected', 'in-transit', 'received', 'partial-receipt', 'short-receipt', 'damaged-on-arrival', 'overdue'];

export default function SupplierManifestsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboundStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = mockSupplierManifests
    .filter(m => filter === 'all' || m.inboundStatus === filter)
    .filter(m =>
      m.manifestId.toLowerCase().includes(search.toLowerCase()) ||
      m.supplierName.toLowerCase().includes(search.toLowerCase()) ||
      m.supplierReference.toLowerCase().includes(search.toLowerCase()) ||
      m.rows.some(r => r.sku.toLowerCase().includes(search.toLowerCase()))
    );

  const totalExpected = mockSupplierManifests.filter(m => ['expected', 'in-transit'].includes(m.inboundStatus)).length;
  const totalReceived = mockSupplierManifests.filter(m => m.inboundStatus === 'received').length;
  const totalIssues = mockSupplierManifests.filter(m => ['short-receipt', 'damaged-on-arrival', 'overdue'].includes(m.inboundStatus)).length;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Supplier Manifests</h1>
        <p className="text-sm text-muted-foreground">{mockSupplierManifests.length} manifests · Inbound stock tracking</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card before:bg-gradient-to-r before:from-info before:to-transparent">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-info" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">In Transit</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalExpected}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-success before:to-transparent">
          <div className="flex items-center gap-1.5">
            <CheckCircle className="w-3.5 h-3.5 text-success" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Received</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalReceived}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-warning before:to-transparent">
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-warning" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Issues</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalIssues}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-primary before:to-transparent">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total SKU Lines</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {mockSupplierManifests.reduce((s, m) => s + m.rows.length, 0)}
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusFilter.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search manifest, supplier, SKU..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {/* Manifest table */}
      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">Manifest</th>
                <th className="text-left py-3 px-4">Supplier</th>
                <th className="text-left py-3 px-4">Ref</th>
                <th className="text-left py-3 px-4">Shipped</th>
                <th className="text-left py-3 px-4">ETA</th>
                <th className="text-left py-3 px-4">Received</th>
                <th className="text-center py-3 px-4">Lines</th>
                <th className="text-left py-3 px-4">Status</th>
                <th className="text-left py-3 px-4">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const isExpanded = expandedId === m.manifestId;
                return (
                  <>
                    <tr
                      key={m.manifestId}
                      onClick={() => setExpandedId(isExpanded ? null : m.manifestId)}
                      className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 font-mono text-primary font-medium">{m.manifestId}</td>
                      <td className="py-3 px-4 text-foreground">{m.supplierName}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.supplierReference}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.shippedDate}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.expectedArrivalDate}</td>
                      <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{m.receivedDate || '—'}</td>
                      <td className="py-3 px-4 text-center font-mono text-foreground">{m.rows.length}</td>
                      <td className="py-3 px-4"><StatusBadge status={m.inboundStatus} /></td>
                      <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes}</td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${m.manifestId}-detail`}>
                        <td colSpan={9} className="bg-muted/10 px-4 py-3">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                            Line Items — {m.manifestId}
                          </p>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-muted-foreground uppercase tracking-wider">
                                <th className="text-left py-1.5 px-2">SKU</th>
                                <th className="text-left py-1.5 px-2">Product</th>
                                <th className="text-right py-1.5 px-2">Shipped</th>
                                <th className="text-right py-1.5 px-2">Received</th>
                                <th className="text-right py-1.5 px-2">Short</th>
                                <th className="text-right py-1.5 px-2">Damaged</th>
                                <th className="text-left py-1.5 px-2">Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {m.rows.map((r, i) => (
                                <tr key={i} className="border-t border-border/30">
                                  <td className="py-1.5 px-2 font-mono text-primary">{r.sku}</td>
                                  <td className="py-1.5 px-2 text-foreground">{r.productName}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-foreground">{r.quantityShipped}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-foreground">{r.quantityReceived ?? '—'}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-warning">{r.quantityShort || '—'}</td>
                                  <td className="py-1.5 px-2 text-right font-mono text-destructive">{r.quantityDamaged || '—'}</td>
                                  <td className="py-1.5 px-2"><StatusBadge status={r.rowStatus === 'pending' ? 'processing' : r.rowStatus === 'received' ? 'completed' : r.rowStatus === 'short' ? 'low-stock' : r.rowStatus === 'damaged' ? 'damaged' : 'low-stock'} /></td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
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
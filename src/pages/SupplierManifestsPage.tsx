import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useManufacturerManifests } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Ship, Search, Package, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { useState } from "react";

const statusFilters = ['all', 'pending', 'partially_received', 'received', 'closed'] as const;

export default function SupplierManifestsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { currentCompany } = useCompany();
  const { data: manifests = [], isLoading } = useManufacturerManifests();

  const filtered = manifests
    .filter(m => filter === 'all' || m.status === filter)
    .filter(m =>
      (m.manifest_number || '').toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer_name.toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer_manifest_items.some(r => (r.sku || '').toLowerCase().includes(search.toLowerCase()))
    );

  const totalExpected = manifests.filter(m => ['pending'].includes(m.status)).length;
  const totalReceived = manifests.filter(m => m.status === 'received' || m.status === 'closed').length;
  const totalIssues = manifests.filter(m => m.status === 'partially_received').length;

  if (!currentCompany) return <EmptyState icon={Ship} title="No company selected" />;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Manufacturer Inbound</h1>
        <p className="text-sm text-muted-foreground">{manifests.length} manifests · Inbound stock tracking</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="kpi-card before:bg-gradient-to-r before:from-info before:to-transparent">
          <div className="flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-info" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pending</p>
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
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Partial</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">{totalIssues}</p>
        </div>
        <div className="kpi-card before:bg-gradient-to-r before:from-primary before:to-transparent">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" />
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Total Lines</p>
          </div>
          <p className="text-xl font-bold font-mono text-foreground">
            {manifests.reduce((s, m) => s + m.manufacturer_manifest_items.length, 0)}
          </p>
        </div>
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {statusFilters.map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
              filter === s
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-muted-foreground border-border hover:bg-muted'
            }`}
          >
            {s === 'all' ? 'All' : s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text" placeholder="Search manifest, manufacturer, SKU..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? <LoadingSpinner message="Loading manifests..." /> : filtered.length === 0 ? (
        <EmptyState icon={Ship} title="No manifests" description="Manufacturer inbound manifests will appear here." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Manifest</th>
                  <th className="text-left py-3 px-4">Manufacturer</th>
                  <th className="text-left py-3 px-4">Expected</th>
                  <th className="text-left py-3 px-4">Received</th>
                  <th className="text-center py-3 px-4">Lines</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Notes</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const isExpanded = expandedId === m.id;
                  return (
                    <>
                      <tr
                        key={m.id}
                        onClick={() => setExpandedId(isExpanded ? null : m.id)}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-primary font-medium">{m.manifest_number || '—'}</td>
                        <td className="py-3 px-4 text-foreground">{m.manufacturer_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {m.expected_date ? new Date(m.expected_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {m.received_date ? new Date(m.received_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-foreground">{m.manufacturer_manifest_items.length}</td>
                        <td className="py-3 px-4"><StatusBadge status={m.status} /></td>
                        <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{m.notes || '—'}</td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${m.id}-detail`}>
                          <td colSpan={7} className="bg-muted/10 px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Line Items — {m.manifest_number}
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground uppercase tracking-wider">
                                  <th className="text-left py-1.5 px-2">SKU</th>
                                  <th className="text-right py-1.5 px-2">Expected</th>
                                  <th className="text-right py-1.5 px-2">Received</th>
                                  <th className="text-right py-1.5 px-2">Short</th>
                                  <th className="text-right py-1.5 px-2">Damaged</th>
                                  <th className="text-left py-1.5 px-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.manufacturer_manifest_items.map(r => (
                                  <tr key={r.id} className="border-t border-border/30">
                                    <td className="py-1.5 px-2 font-mono text-primary">{r.sku || '—'}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-foreground">{r.expected_qty}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-foreground">{r.received_qty || '—'}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-warning">{r.short_qty || '—'}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-destructive">{r.damaged_qty || '—'}</td>
                                    <td className="py-1.5 px-2"><StatusBadge status={r.status} /></td>
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
      )}
    </div>
  );
}

import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import KpiCard from "@/components/KpiCard";
import { useShipments } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Truck, Search, AlertTriangle, CheckCircle, Clock, Package } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "@/hooks/use-mobile";

type StatusFilter = 'all' | 'in_transit' | 'delivered' | 'label_created' | 'exception';

export default function ShipmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { currentCompany } = useCompany();
  const { data: shipments = [], isLoading } = useShipments();
  const navigate = useNavigate();
  const isMobile = useIsMobile();

  const filtered = shipments
    .filter(s => {
      if (statusFilter === 'all') return true;
      if (statusFilter === 'exception') return ['exception', 'failed', 'returned'].includes(s.status);
      return s.status === statusFilter;
    })
    .filter(s =>
      (s.shipment_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.orders?.order_number || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.orders?.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.carrier || '').toLowerCase().includes(search.toLowerCase()) ||
      (s.tracking_number || '').toLowerCase().includes(search.toLowerCase())
    );

  const counts = {
    inTransit: shipments.filter(s => s.status === 'in_transit').length,
    delivered: shipments.filter(s => s.status === 'delivered').length,
    labelCreated: shipments.filter(s => s.status === 'label_created').length,
    exception: shipments.filter(s => ['exception', 'failed', 'returned'].includes(s.status)).length,
  };

  if (!currentCompany) return <EmptyState icon={Truck} title="No company selected" />;

  const tabs = [
    { key: 'all' as const, label: `All (${shipments.length})` },
    { key: 'in_transit' as const, label: `In Transit (${counts.inTransit})` },
    { key: 'delivered' as const, label: `Delivered (${counts.delivered})` },
    { key: 'label_created' as const, label: `Label Created (${counts.labelCreated})` },
    { key: 'exception' as const, label: `Exception (${counts.exception})` },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Shipment Tracking</h1>
        <p className="text-sm text-muted-foreground">{shipments.length} shipments · Carrier follow-up & delivery management</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="In Transit" value={counts.inTransit} icon={Truck} variant="info" />
        <KpiCard title="Delivered" value={counts.delivered} icon={CheckCircle} variant="success" />
        <KpiCard title="Label Created" value={counts.labelCreated} icon={Clock} variant="warning" />
        <KpiCard title="Exceptions" value={counts.exception} icon={AlertTriangle} variant="danger" />
      </div>

      {/* Filter row: tabs + search on same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {tabs.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                statusFilter === f.key
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
            type="text"
            placeholder="Search shipment, order, customer, carrier..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
          Showing {filtered.length} of {shipments.length}
        </span>
      </div>

      {isLoading ? <LoadingSpinner message="Loading shipments..." /> : filtered.length === 0 ? (
        <EmptyState icon={Truck} title="No shipments" description="Shipments will appear here once orders are fulfilled." />
      ) : isMobile ? (
        <div className="space-y-2">
          {filtered.map(s => (
            <div
              key={s.id}
              onClick={() => s.orders?.order_number && navigate(`/orders/${s.orders.order_number}`)}
              className="bg-card border border-border rounded-lg p-3 active:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-primary font-medium text-sm">{s.shipment_number || '—'}</span>
                <StatusBadge status={s.status} />
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                <span>Order: <span className="text-info font-mono">{s.orders?.order_number || '—'}</span></span>
                <span>{s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : '—'}</span>
              </div>
              <p className="text-sm text-foreground truncate">{s.orders?.customer_name || '—'}</p>
              <div className="flex items-center justify-between mt-1.5 text-xs text-muted-foreground">
                <span>{s.carrier || '—'}</span>
                <span className="font-mono truncate max-w-[140px]">{s.tracking_number || 'No tracking'}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Shipment #</th>
                  <th className="text-left py-3 px-4">Order</th>
                  <th className="text-left py-3 px-4">Customer</th>
                  <th className="text-left py-3 px-4">Carrier</th>
                  <th className="text-left py-3 px-4">Tracking</th>
                  <th className="text-left py-3 px-4">Shipped</th>
                  <th className="text-left py-3 px-4">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr
                    key={s.id}
                    onClick={() => s.orders?.order_number && navigate(`/orders/${s.orders.order_number}`)}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-primary">{s.shipment_number || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-info">{s.orders?.order_number || '—'}</td>
                    <td className="py-3 px-4 text-foreground">{s.orders?.customer_name || '—'}</td>
                    <td className="py-3 px-4 text-foreground">{s.carrier || '—'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{s.tracking_number || 'Pending'}</td>
                    <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                      {s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={s.status} /></td>
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

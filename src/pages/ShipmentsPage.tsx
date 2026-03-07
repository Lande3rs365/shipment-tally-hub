import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import KpiCard from "@/components/KpiCard";
import { useShipments } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Truck, Search, AlertTriangle, CheckCircle, Clock, Package } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

type StatusFilter = 'all' | 'in_transit' | 'delivered' | 'label_created' | 'exception';

export default function ShipmentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const { currentCompany } = useCompany();
  const { data: shipments = [], isLoading } = useShipments();
  const navigate = useNavigate();

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

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Shipment Tracking</h1>
        <p className="text-sm text-muted-foreground">{shipments.length} shipments · Carrier follow-up & delivery management</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="In Transit" value={counts.inTransit} icon={Truck} variant="info" />
        <KpiCard title="Delivered" value={counts.delivered} icon={CheckCircle} variant="success" />
        <KpiCard title="Label Created" value={counts.labelCreated} icon={Clock} variant="warning" />
        <KpiCard title="Exceptions" value={counts.exception} icon={AlertTriangle} variant="danger" />
      </div>

      {/* Filter chips */}
      <div className="flex items-center gap-2 flex-wrap">
        {([
          { key: 'all', label: `All (${shipments.length})` },
          { key: 'in_transit', label: `In Transit (${counts.inTransit})` },
          { key: 'delivered', label: `Delivered (${counts.delivered})` },
          { key: 'label_created', label: `Label Created (${counts.labelCreated})` },
          { key: 'exception', label: `Exception (${counts.exception})` },
        ] as const).map(f => (
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

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search shipment, order, customer, carrier..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? <LoadingSpinner message="Loading shipments..." /> : filtered.length === 0 ? (
        <EmptyState icon={Truck} title="No shipments" description="Shipments will appear here once orders are fulfilled." />
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

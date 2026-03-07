import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useShipments } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Truck } from "lucide-react";

export default function ShipmentsPage() {
  const { currentCompany } = useCompany();
  const { data: shipments = [], isLoading } = useShipments();

  if (!currentCompany) return <EmptyState icon={Truck} title="No company selected" />;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Shipments</h1>
        <p className="text-sm text-muted-foreground">{shipments.length} shipments</p>
      </div>

      {isLoading ? <LoadingSpinner message="Loading shipments..." /> : shipments.length === 0 ? (
        <EmptyState icon={Truck} title="No shipments yet" description="Shipments will appear here once orders are fulfilled." />
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
                {shipments.map(s => (
                  <tr key={s.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
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

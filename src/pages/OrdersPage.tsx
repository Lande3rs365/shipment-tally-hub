import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useOrders } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Package, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { data: orders = [], isLoading } = useOrders();

  const filtered = orders.filter(o =>
    o.order_number.toLowerCase().includes(search.toLowerCase()) ||
    (o.customer_name || '').toLowerCase().includes(search.toLowerCase()) ||
    (o.customer_email || '').toLowerCase().includes(search.toLowerCase())
  );

  if (!currentCompany) return <EmptyState icon={Package} title="No company selected" description="Create or join a company to view orders." />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Orders</h1>
          <p className="text-sm text-muted-foreground">{orders.length} orders · Click any row for detail view</p>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search orders..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>

      {isLoading ? <LoadingSpinner message="Loading orders..." /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No orders yet" description="Orders will appear here once data is imported." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Order</th>
                  <th className="text-left py-3 px-4">Date</th>
                  <th className="text-left py-3 px-4">Customer</th>
                  <th className="text-left py-3 px-4">Items</th>
                  <th className="text-left py-3 px-4">Woo Status</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Source</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(order => (
                  <tr
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.order_number}`)}
                    className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                  >
                    <td className="py-3 px-4 font-mono text-primary font-medium">{order.order_number}</td>
                    <td className="py-3 px-4 text-muted-foreground font-mono text-xs">
                      {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-3 px-4">
                      <p className="text-foreground">{order.customer_name || '—'}</p>
                      <p className="text-xs text-muted-foreground">{order.customer_email || ''}</p>
                    </td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">
                      {order.order_items?.map(i => `${i.sku || '?'} ×${i.quantity}`).join(', ') || '—'}
                    </td>
                    <td className="py-3 px-4"><StatusBadge status={order.woo_status || 'processing'} /></td>
                    <td className="py-3 px-4"><StatusBadge status={order.status} /></td>
                    <td className="py-3 px-4 text-xs text-muted-foreground">{order.source || '—'}</td>
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

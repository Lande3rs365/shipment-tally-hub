import { useParams, Link } from "react-router-dom";
import { useOrder, useOrderEvents, useStockMovements } from "@/hooks/useSupabaseData";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ArrowLeft, Package, Clock } from "lucide-react";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: events = [] } = useOrderEvents(order?.id);

  if (isLoading) return <div className="p-6"><LoadingSpinner message="Loading order..." /></div>;

  if (!order) {
    return (
      <div className="p-6">
        <Link to="/orders" className="text-primary hover:underline text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        <p className="mt-4 text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/orders" className="text-primary hover:underline text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{order.customer_name} · {order.customer_email}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Status</p>
          <StatusBadge status={order.status} />
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Source</p>
          <p className="text-foreground font-medium text-sm">{order.source || '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-foreground font-mono font-medium text-sm">
            {order.total_amount != null ? `$${order.total_amount}` : '—'}
          </p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Order Date</p>
          <p className="text-foreground font-mono text-xs">
            {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
          </p>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Order Items</h2>
        {order.order_items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <th className="text-left py-2 px-3">SKU</th>
                <th className="text-right py-2 px-3">Qty</th>
                <th className="text-right py-2 px-3">Unit Price</th>
                <th className="text-right py-2 px-3">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map(item => (
                <tr key={item.id} className="border-b border-border/30">
                  <td className="py-2 px-3 font-mono text-primary">{item.sku || '—'}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{item.quantity}</td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">
                    {item.unit_price != null ? `$${item.unit_price}` : '—'}
                  </td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">
                    {item.line_total != null ? `$${item.line_total}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event Timeline */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          Event Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events recorded for this order.</p>
        ) : (
          <div className="relative ml-3">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {events.map(ev => (
                <div key={ev.id} className="relative pl-6">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                  <div>
                    <p className="text-sm text-foreground">{ev.description || ev.event_type}</p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {new Date(ev.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

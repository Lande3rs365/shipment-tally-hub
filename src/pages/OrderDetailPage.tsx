import { useParams, Link } from "react-router-dom";
import { mockOrders, mockOrderEvents, mockMovements } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { ArrowLeft, Package, Truck, Warehouse, AlertTriangle, MessageSquare, Clock } from "lucide-react";

const eventIcons: Record<string, string> = {
  ORDER_IMPORTED: '📥',
  ORDER_RESERVED: '📦',
  RESERVATION_FAILED: '⚠️',
  STOCK_ALLOCATED: '🏷️',
  SHIPMENT_CONFIRMED: '🚚',
  DELIVERED: '✅',
  EXCEPTION_FLAGGED: '🚩',
  LABEL_CREATED: '🏷️',
};

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const order = mockOrders.find(o => o.orderId === orderId);

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

  const events = mockOrderEvents[order.orderId] || [];
  const movements = mockMovements.filter(m => m.linkedOrderId === order.orderId);

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/orders" className="text-primary hover:underline text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            {order.orderId}
            {order.exceptionFlag && <span className="w-2.5 h-2.5 rounded-full bg-destructive" />}
          </h1>
          <p className="text-sm text-muted-foreground">{order.customerName} · {order.customerEmail}</p>
        </div>
        <p className="text-xs text-muted-foreground font-mono">Updated {new Date(order.lastUpdated).toLocaleString()}</p>
      </div>

      {/* Status layers */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Woo Status', value: order.wooStatus, icon: Package },
          { label: 'Shipment', value: order.shipmentStatus, icon: Truck },
          { label: 'Inventory', value: order.inventoryStatus, icon: Warehouse },
          { label: 'Operational', value: order.operationalStatus, icon: AlertTriangle },
          { label: 'Support', value: null, icon: MessageSquare },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-lg p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{s.label}</p>
            </div>
            {s.value ? <StatusBadge status={s.value} /> : <p className="text-xs text-foreground">{order.supportStatus}</p>}
          </div>
        ))}
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Order Items</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
              <th className="text-left py-2 px-3">SKU</th>
              <th className="text-left py-2 px-3">Product</th>
              <th className="text-right py-2 px-3">Qty</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map(item => (
              <tr key={item.sku} className="border-b border-border/30">
                <td className="py-2 px-3 font-mono text-primary">{item.sku}</td>
                <td className="py-2 px-3 text-foreground">{item.name}</td>
                <td className="py-2 px-3 text-right font-mono text-foreground">{item.quantity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Shipment info */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Shipment Details</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Carrier</p>
            <p className="text-foreground font-medium">{order.shipmentCarrier || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Tracking</p>
            <p className="text-foreground font-mono text-xs">{order.trackingNumber || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Ship Date</p>
            <p className="text-foreground font-mono text-xs">{order.shipmentDate || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Source File</p>
            <p className="text-foreground font-mono text-xs">{order.sourceFile}</p>
          </div>
        </div>
      </div>

      {/* Timeline */}
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
              {events.map((ev, i) => (
                <div key={i} className="relative pl-6">
                  <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                  <div className="flex items-start gap-3">
                    <span className="text-base">{eventIcons[ev.eventType] || '📋'}</span>
                    <div>
                      <p className="text-sm text-foreground">{ev.description}</p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {new Date(ev.timestamp).toLocaleString()} · {ev.user}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Stock movements linked to this order */}
      {movements.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Linked Stock Movements</h2>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-muted-foreground uppercase tracking-wider border-b border-border">
                <th className="text-left py-2 px-2">Time</th>
                <th className="text-left py-2 px-2">SKU</th>
                <th className="text-left py-2 px-2">Type</th>
                <th className="text-right py-2 px-2">Qty</th>
                <th className="text-left py-2 px-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {movements.map(m => (
                <tr key={m.movementId} className="border-b border-border/30">
                  <td className="py-1.5 px-2 font-mono text-muted-foreground">
                    {new Date(m.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </td>
                  <td className="py-1.5 px-2 font-mono text-primary">{m.sku}</td>
                  <td className="py-1.5 px-2 text-foreground">{m.movementType.replace(/_/g, ' ')}</td>
                  <td className="py-1.5 px-2 text-right font-mono font-medium">
                    {m.direction === 'OUT' ? `-${m.quantity}` : `+${m.quantity}`}
                  </td>
                  <td className="py-1.5 px-2 text-muted-foreground">{m.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notes */}
      {order.notes.length > 0 && (
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-3">Internal Notes</h2>
          <div className="space-y-2">
            {order.notes.map((n, i) => (
              <p key={i} className="text-sm text-foreground bg-muted/30 rounded-md px-3 py-2">{n}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
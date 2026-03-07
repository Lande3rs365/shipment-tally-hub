import StatusBadge from "@/components/StatusBadge";
import { mockOrders } from "@/data/mockData";
import { Package, Search } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const filtered = mockOrders.filter(o =>
    o.orderId.toLowerCase().includes(search.toLowerCase()) ||
    o.customerName.toLowerCase().includes(search.toLowerCase()) ||
    o.customerEmail.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Master Orders</h1>
          <p className="text-sm text-muted-foreground">{mockOrders.length} orders · Click any row for detail view</p>
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

      <div className="bg-card border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-3 px-4">Order</th>
                <th className="text-left py-3 px-4">Date</th>
                <th className="text-left py-3 px-4">Customer</th>
                <th className="text-left py-3 px-4">Items</th>
                <th className="text-left py-3 px-4">Woo</th>
                <th className="text-left py-3 px-4">Shipment</th>
                <th className="text-left py-3 px-4">Inventory</th>
                <th className="text-left py-3 px-4">Ops</th>
                <th className="text-left py-3 px-4">Support</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(order => (
                <tr
                  key={order.id}
                  onClick={() => navigate(`/orders/${order.orderId}`)}
                  className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      {order.exceptionFlag && <span className="w-1.5 h-1.5 rounded-full bg-destructive" />}
                      <span className="font-mono text-primary font-medium">{order.orderId}</span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-muted-foreground font-mono text-xs">{order.orderDate}</td>
                  <td className="py-3 px-4">
                    <p className="text-foreground">{order.customerName}</p>
                    <p className="text-xs text-muted-foreground">{order.customerEmail}</p>
                  </td>
                  <td className="py-3 px-4 text-xs text-muted-foreground">
                    {order.items.map(i => `${i.sku} ×${i.quantity}`).join(', ')}
                  </td>
                  <td className="py-3 px-4"><StatusBadge status={order.wooStatus} /></td>
                  <td className="py-3 px-4"><StatusBadge status={order.shipmentStatus} /></td>
                  <td className="py-3 px-4"><StatusBadge status={order.inventoryStatus} /></td>
                  <td className="py-3 px-4"><StatusBadge status={order.operationalStatus} /></td>
                  <td className="py-3 px-4 text-xs text-muted-foreground max-w-[200px] truncate">{order.supportStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
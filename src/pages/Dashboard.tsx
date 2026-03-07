import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import { kpiData, mockOrders, mockExceptions, mockInventory, mockSupplierManifests, mockMovements } from "@/data/mockData";
import {
  Package, Truck, Warehouse, AlertTriangle, CheckCircle,
  Clock, XCircle, ArrowUpRight, BarChart3, Ship, RotateCcw
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

const chartData = [
  { name: 'Shipped', value: kpiData.ordersShipped, color: 'hsl(142, 71%, 45%)' },
  { name: 'Awaiting', value: kpiData.awaitingShipment, color: 'hsl(199, 89%, 48%)' },
  { name: 'Delayed', value: kpiData.delayedByStock, color: 'hsl(38, 92%, 50%)' },
  { name: 'Backlog', value: kpiData.backlogOrders, color: 'hsl(0, 72%, 51%)' },
];

export default function Dashboard() {
  const navigate = useNavigate();
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">Distribution & Inventory Control Hub</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          Live — Last sync 2 min ago
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard title="Total Orders" value={kpiData.totalOrders} icon={Package} variant="info" />
        <KpiCard title="Shipped" value={kpiData.ordersShipped} icon={Truck} variant="success" />
        <KpiCard title="Awaiting Ship" value={kpiData.awaitingShipment} icon={Clock} variant="warning" />
        <KpiCard title="Exceptions" value={kpiData.exceptions} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Stock SKUs" value={kpiData.totalSKUs} icon={Warehouse} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Order Distribution
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="30%">
              <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(222, 44%, 9%)', border: '1px solid hsl(215, 25%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 92%)' }} />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Stock Alerts */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-warning" />
            Stock Alerts
          </h2>
          <div className="space-y-3">
            {mockInventory.filter(i => i.status !== 'in-stock').map(item => (
              <div key={item.sku} className="flex items-center justify-between text-sm">
                <div>
                  <p className="font-medium text-foreground">{item.productName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.sku}</p>
                </div>
                <StatusBadge status={item.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Returns Summary */}
      {(() => {
        const returnMovements = mockMovements.filter(m =>
          m.movementType === 'RETURN_RESTOCKED' || m.movementType === 'RETURN_DEFECTIVE' || m.movementType === 'RETURN_QUARANTINE'
        );
        const restocked = returnMovements.filter(m => m.movementType === 'RETURN_RESTOCKED');
        const defective = returnMovements.filter(m => m.movementType === 'RETURN_DEFECTIVE');
        const quarantine = returnMovements.filter(m => m.movementType === 'RETURN_QUARANTINE');
        const totalQty = returnMovements.reduce((s, m) => s + m.quantity, 0);
        const restockedQty = restocked.reduce((s, m) => s + m.quantity, 0);
        const restockRate = totalQty > 0 ? Math.round((restockedQty / totalQty) * 100) : 0;

        const conditionData = [
          { label: 'Resellable', count: restocked.length, qty: restockedQty, statusClass: 'status-in-stock' },
          { label: 'Defective', count: defective.length, qty: defective.reduce((s, m) => s + m.quantity, 0), statusClass: 'status-exception' },
          { label: 'Quarantine', count: quarantine.length, qty: quarantine.reduce((s, m) => s + m.quantity, 0), statusClass: 'status-low-stock' },
        ];

        return (
          <div className="bg-card border border-border rounded-lg p-5">
            <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-primary" />
              Returns Summary
            </h2>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center p-3 rounded-md bg-muted/30 border border-border/50">
                <p className="text-2xl font-bold font-mono text-foreground">{returnMovements.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Returns</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/30 border border-border/50">
                <p className="text-2xl font-bold font-mono text-foreground">{totalQty}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Units</p>
              </div>
              <div className="text-center p-3 rounded-md bg-muted/30 border border-border/50">
                <p className="text-2xl font-bold font-mono text-success">{restockRate}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Restock Rate</p>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Condition Breakdown</p>
              {conditionData.map(c => (
                <div key={c.label} className="flex items-center justify-between p-2.5 rounded-md bg-muted/20 border border-border/50">
                  <div className="flex items-center gap-2">
                    <span className={`status-badge ${c.statusClass}`}>{c.label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="text-muted-foreground">{c.count} return{c.count !== 1 ? 's' : ''}</span>
                    <span className="font-mono font-medium text-foreground">{c.qty} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Ship className="w-4 h-4 text-info" />
          Supplier Inbound
        </h2>
        <div className="space-y-2">
          {mockSupplierManifests.map(m => (
            <div key={m.manifestId} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
              <div>
                <p className="text-sm font-medium text-foreground">{m.supplierName}</p>
                <p className="text-xs text-muted-foreground font-mono">{m.manifestId} · {m.rows.map(r => r.sku).join(', ')}</p>
              </div>
              <StatusBadge status={m.inboundStatus} />
            </div>
          ))}
        </div>
      </div>

      {/* Exceptions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Active Exceptions
        </h2>
        <div className="space-y-2">
          {mockExceptions.filter(e => !e.resolved).map(exc => (
            <div key={exc.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border">
              <div className="flex items-center gap-3">
                <StatusBadge status={exc.severity} />
                <div>
                  <p className="text-sm font-medium text-foreground">{exc.description}</p>
                  <p className="text-xs text-muted-foreground">Order: {exc.orderId} · {exc.type}</p>
                </div>
              </div>
              <span className="text-xs text-muted-foreground font-mono">
                {new Date(exc.detectedAt).toLocaleDateString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-info" />
          Recent Orders
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                <th className="text-left py-2 px-3">Order</th>
                <th className="text-left py-2 px-3">Customer</th>
                <th className="text-left py-2 px-3">Source / Cost Centre</th>
                <th className="text-left py-2 px-3">Woo Status</th>
                <th className="text-left py-2 px-3">Shipment</th>
                <th className="text-left py-2 px-3">Inventory</th>
                <th className="text-left py-2 px-3">Ops Status</th>
              </tr>
            </thead>
            <tbody>
              {mockOrders.slice(0, 6).map(order => (
                <tr key={order.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-primary">{order.orderId}</td>
                  <td className="py-2.5 px-3 text-foreground">{order.customerName}</td>
                  <td className="py-2.5 px-3">
                    <span className="font-mono text-xs bg-muted/50 text-muted-foreground px-2 py-0.5 rounded">{order.companyId}</span>
                  </td>
                  <td className="py-2.5 px-3"><StatusBadge status={order.wooStatus} /></td>
                  <td className="py-2.5 px-3"><StatusBadge status={order.shipmentStatus} /></td>
                  <td className="py-2.5 px-3"><StatusBadge status={order.inventoryStatus} /></td>
                  <td className="py-2.5 px-3"><StatusBadge status={order.operationalStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Package, Truck, Warehouse, AlertTriangle,
  BarChart3, Ship, RotateCcw, Clock, ArrowRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { data: stats, isLoading } = useDashboardStats();

  if (companyLoading || isLoading) return <div className="p-6"><LoadingSpinner message="Loading dashboard..." /></div>;

  if (!currentCompany) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Package}
          title="No company set up"
          description="Create a company to start using DistroHub. Go to settings or ask an admin to add you."
        />
      </div>
    );
  }

  const chartData = [
    { name: 'Shipped', value: stats?.ordersShipped || 0, color: 'hsl(var(--success))' },
    { name: 'Awaiting', value: stats?.awaitingShipment || 0, color: 'hsl(var(--info))' },
    { name: 'Exceptions', value: stats?.exceptions || 0, color: 'hsl(var(--destructive))' },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">{currentCompany.name} · Distribution & Inventory Control Hub</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
          Live
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard title="Total Orders" value={stats?.totalOrders || 0} icon={Package} variant="info" />
        <KpiCard title="Shipped" value={stats?.ordersShipped || 0} icon={Truck} variant="success" />
        <KpiCard title="Awaiting Ship" value={stats?.awaitingShipment || 0} icon={Clock} variant="warning" />
        <KpiCard title="Exceptions" value={stats?.exceptions || 0} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Stock SKUs" value={stats?.totalSKUs || 0} icon={Warehouse} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Order Distribution
          </h2>
          {(stats?.totalOrders || 0) === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">
              No order data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: 8,
                    color: 'hsl(var(--foreground))',
                  }}
                  cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stock Alerts */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-warning" />
            Stock Alerts
          </h2>
          {(stats?.inventoryAlerts || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No stock alerts</p>
          ) : (
            <div className="space-y-3">
              {stats!.inventoryAlerts.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => navigate(`/inventory?sku=${encodeURIComponent(item.products?.sku || '')}`)}
                  className="w-full flex items-center justify-between text-sm hover:bg-muted/30 rounded-md px-2 py-1.5 -mx-2 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium text-foreground">{item.products?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.products?.sku || '—'}</p>
                  </div>
                  <span className="font-mono text-xs text-destructive">{item.on_hand} on hand</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Recent Orders
          </h2>
          <button onClick={() => navigate('/orders')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {(stats?.recentOrders || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No orders yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                  <th className="text-left py-2 px-3">Order</th>
                  <th className="text-left py-2 px-3">Customer</th>
                  <th className="text-left py-2 px-3">Date</th>
                  <th className="text-left py-2 px-3">Woo Status</th>
                  <th className="text-left py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {stats!.recentOrders.map((o: any) => (
                  <tr
                    key={o.id}
                    onClick={() => navigate(`/orders/${o.order_number}`)}
                    className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <td className="py-2 px-3 font-mono text-primary font-medium">{o.order_number}</td>
                    <td className="py-2 px-3 text-foreground">{o.customer_name || '—'}</td>
                    <td className="py-2 px-3 font-mono text-xs text-muted-foreground">
                      {o.order_date ? new Date(o.order_date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 px-3"><StatusBadge status={o.woo_status || 'processing'} /></td>
                    <td className="py-2 px-3"><StatusBadge status={o.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manufacturer Inbound */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Ship className="w-4 h-4 text-info" />
            Manufacturer Inbound
          </h2>
          <button onClick={() => navigate('/supplier-manifests')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {(stats?.manifests || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No inbound manifests</p>
        ) : (
          <div className="space-y-2">
            {stats!.manifests.map((m: any) => (
              <div
                key={m.id}
                onClick={() => navigate('/supplier-manifests')}
                className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{m.manufacturer_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.manifest_number || '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.tracking_number && (
                    <span className="text-xs font-mono text-muted-foreground">{m.tracking_number}</span>
                  )}
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exceptions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Active Exceptions
          </h2>
          <button onClick={() => navigate('/exceptions')} className="text-xs text-primary hover:underline flex items-center gap-1">
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {(stats?.activeExceptions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No active exceptions</p>
        ) : (
          <div className="space-y-2">
            {stats!.activeExceptions.map((exc: any) => (
              <div
                key={exc.id}
                onClick={() => navigate('/exceptions')}
                className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border cursor-pointer hover:bg-muted/70 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <StatusBadge status={exc.severity} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{exc.title}</p>
                    <p className="text-xs text-muted-foreground">{exc.exception_type.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {new Date(exc.created_at).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

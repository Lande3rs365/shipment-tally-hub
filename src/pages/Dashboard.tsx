import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Package, Truck, Warehouse, AlertTriangle,
  BarChart3, Ship, RotateCcw, Clock
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
    { name: 'Shipped', value: stats?.ordersShipped || 0, color: 'hsl(142, 71%, 45%)' },
    { name: 'Awaiting', value: stats?.awaitingShipment || 0, color: 'hsl(199, 89%, 48%)' },
    { name: 'Exceptions', value: stats?.exceptions || 0, color: 'hsl(0, 72%, 51%)' },
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
                <XAxis dataKey="name" tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(215, 20%, 55%)', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(222, 44%, 9%)', border: '1px solid hsl(215, 25%, 18%)', borderRadius: 8, color: 'hsl(210, 40%, 92%)' }} />
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
                <div key={item.id} className="flex items-center justify-between text-sm">
                  <div>
                    <p className="font-medium text-foreground">{item.products?.name || '—'}</p>
                    <p className="text-xs text-muted-foreground font-mono">{item.products?.sku || '—'}</p>
                  </div>
                  <span className="font-mono text-xs text-destructive">{item.on_hand} on hand</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manufacturer Inbound */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Ship className="w-4 h-4 text-info" />
          Manufacturer Inbound
        </h2>
        {(stats?.manifests || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No inbound manifests</p>
        ) : (
          <div className="space-y-2">
            {stats!.manifests.map((m: any) => (
              <div key={m.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
                <div>
                  <p className="text-sm font-medium text-foreground">{m.manufacturer_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.manifest_number || '—'}</p>
                </div>
                <StatusBadge status={m.status} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Exceptions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          Active Exceptions
        </h2>
        {(stats?.activeExceptions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No active exceptions</p>
        ) : (
          <div className="space-y-2">
            {stats!.activeExceptions.map((exc: any) => (
              <div key={exc.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 border border-border">
                <div className="flex items-center gap-3">
                  <StatusBadge status={exc.severity} />
                  <div>
                    <p className="text-sm font-medium text-foreground">{exc.title}</p>
                    <p className="text-xs text-muted-foreground">{exc.exception_type}</p>
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

import { useState } from "react";
import KpiCard from "@/components/KpiCard";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useDashboardStats } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import {
  Package, Truck, Warehouse, AlertTriangle,
  BarChart3, Ship, Clock, ArrowRight, ChevronLeft, ChevronRight,
  ArrowUpDown, ArrowUp, ArrowDown, Zap,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { startOfWeek, startOfMonth, isAfter, format } from "date-fns";

type Period = "week" | "month" | "all";
type SortDir = "asc" | "desc";
type SortState = { key: string; dir: SortDir };

const PAGE_SIZE = 10;

const sortRows = (rows: any[], sort: SortState): any[] => {
  return [...rows].sort((a, b) => {
    const aVal = sort.key.includes('.') ? sort.key.split('.').reduce((o: any, k: string) => o?.[k], a) : a[sort.key];
    const bVal = sort.key.includes('.') ? sort.key.split('.').reduce((o: any, k: string) => o?.[k], b) : b[sort.key];
    if (aVal == null && bVal == null) return 0;
    if (aVal == null) return 1;
    if (bVal == null) return -1;
    const cmp = typeof aVal === 'number' ? aVal - bVal : String(aVal).localeCompare(String(bVal));
    return sort.dir === 'asc' ? cmp : -cmp;
  });
};

const SortHeader = ({ label, sortKey, current, onSort, className }: { label: string; sortKey: string; current: SortState; onSort: (key: string) => void; className?: string }) => {
  const active = current.key === sortKey;
  return (
    <th className={cn("py-2 px-3 cursor-pointer select-none hover:text-foreground transition-colors", className)} onClick={() => onSort(sortKey)}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active ? (current.dir === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />) : <ArrowUpDown className="w-3 h-3 opacity-40" />}
      </span>
    </th>
  );
};

const Paginator = ({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) => {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between pt-3 border-t border-border/50 mt-3">
      <span className="text-xs text-muted-foreground">Page {page} of {totalPages}</span>
      <div className="flex items-center gap-1">
        <button onClick={onPrev} disabled={page <= 1} className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"><ChevronLeft className="w-4 h-4" /></button>
        <button onClick={onNext} disabled={page >= totalPages} className="p-1 rounded hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed"><ChevronRight className="w-4 h-4" /></button>
      </div>
    </div>
  );
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { currentCompany, loading: companyLoading } = useCompany();
  const { data: stats, isLoading } = useDashboardStats();
  const [period, setPeriod] = useState<Period>("week");
  const [ordersPage, setOrdersPage] = useState(1);
  const [exceptionsPage, setExceptionsPage] = useState(1);
  const [ordersSort, setOrdersSort] = useState<SortState>({ key: 'order_date', dir: 'asc' });
  const [exceptionsSort, setExceptionsSort] = useState<SortState>({ key: 'orders.order_date', dir: 'asc' });

  const toggleSort = (setter: React.Dispatch<React.SetStateAction<SortState>>, pageSetter: React.Dispatch<React.SetStateAction<number>>) => (key: string) => {
    setter(prev => ({ key, dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc' }));
    pageSetter(1);
  };

  if (companyLoading || isLoading) return <div className="p-6"><LoadingSpinner message="Loading dashboard..." /></div>;

  if (!currentCompany) {
    return (
      <div className="p-6">
        <EmptyState icon={Package} title="No company set up" description="Create a company to start using DistroHub." />
      </div>
    );
  }

  // Filter stats by period
  const now = new Date();
  const periodStart = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : period === "month" ? startOfMonth(now) : new Date(0);

  const filterByDate = (dateStr: string | null) => {
    if (period === "all" || !dateStr) return period === "all";
    return isAfter(new Date(dateStr), periodStart);
  };

  const allOrders = stats?.allOrders || [];
  const allShipments = stats?.allShipments || [];
  const periodOrders = period === "all" ? allOrders : allOrders.filter((o: any) => filterByDate(o.order_date || o.created_at));
  const periodShipments = period === "all" ? allShipments : allShipments.filter((s: any) => filterByDate(s.shipped_date || s.created_at));

  const totalOrders = periodOrders.length;
  const shipped = periodOrders.filter((o: any) => ['shipped', 'delivered', 'completed'].includes(o.status)).length;
  const shipmentsToday = stats?.shipmentsToday || 0;
  const exceptionCount = stats?.exceptions || 0;

  const chartData = [
    { name: 'Shipped', value: shipped, color: 'hsl(var(--success))' },
    { name: 'Processing', value: periodOrders.filter((o: any) => o.status === 'processing').length, color: 'hsl(var(--info))' },
    { name: 'Exceptions', value: exceptionCount, color: 'hsl(var(--destructive))' },
  ];

  const periodLabels: Record<Period, string> = { week: "This Week", month: "This Month", all: "All Time" };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Operations Dashboard</h1>
          <p className="text-sm text-muted-foreground">{currentCompany.name} · Distribution & Inventory Control Hub</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-muted rounded-lg p-0.5">
            {(["week", "month", "all"] as Period[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "px-3 py-1.5 text-xs rounded-md transition-colors",
                  p === period
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {periodLabels[p]}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse-glow" />
            Live
          </div>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard title={`Orders (${periodLabels[period]})`} value={totalOrders} icon={Package} variant="info" />
        <KpiCard title="Shipped" value={shipped} icon={Truck} variant="success" />
        <KpiCard title="Shipments Today" value={shipmentsToday} icon={Clock} variant="warning" />
        <KpiCard title="Exceptions" value={exceptionCount} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Returns Pending" value={stats?.returnsPending || 0} icon={Package} variant="default" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Chart */}
        <div className="lg:col-span-2 bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Order Distribution — {periodLabels[period]}
          </h2>
          {totalOrders === 0 ? (
            <div className="flex items-center justify-center h-[220px] text-xs text-muted-foreground">No order data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={chartData} barCategoryGap="30%">
                <XAxis dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} cursor={{ fill: 'hsl(var(--muted) / 0.3)' }} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Stock Alerts — Top 5 */}
        <div className="bg-card border border-border rounded-lg p-5">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
            <Warehouse className="w-4 h-4 text-warning" /> Stock Alerts
          </h2>
          {(stats?.inventoryAlerts || []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No stock alerts</p>
          ) : (
            <div className="space-y-3">
              {stats!.inventoryAlerts.map((item: any) => (
                <button key={item.id} onClick={() => navigate(`/inventory?sku=${encodeURIComponent(item.products?.sku || '')}`)} className="w-full flex items-center justify-between text-sm hover:bg-muted/30 rounded-md px-2 py-1.5 -mx-2 transition-colors text-left">
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

      {/* Today's Processing Orders */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-primary" />
            Today's Orders
            <span className="text-xs font-normal text-muted-foreground">({(stats?.todayProcessing || []).length} processing)</span>
          </h2>
          <button onClick={() => navigate('/orders')} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></button>
        </div>
        {(stats?.todayProcessing || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No processing orders today</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <SortHeader label="Order" sortKey="order_number" current={ordersSort} onSort={toggleSort(setOrdersSort, setOrdersPage)} className="text-left" />
                    <SortHeader label="Customer" sortKey="customer_name" current={ordersSort} onSort={toggleSort(setOrdersSort, setOrdersPage)} className="text-left" />
                    <SortHeader label="Date" sortKey="order_date" current={ordersSort} onSort={toggleSort(setOrdersSort, setOrdersPage)} className="text-left" />
                    <th className="text-left py-2 px-3">Woo Status</th>
                    <SortHeader label="Total" sortKey="total_amount" current={ordersSort} onSort={toggleSort(setOrdersSort, setOrdersPage)} className="text-right" />
                  </tr>
                </thead>
                <tbody>
                  {sortRows(stats!.todayProcessing, ordersSort).slice((ordersPage - 1) * PAGE_SIZE, ordersPage * PAGE_SIZE).map((o: any) => (
                    <tr key={o.id} onClick={() => navigate(`/orders/${o.order_number}`)} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors">
                      <td className="py-2 px-3 font-mono text-primary font-medium">{o.order_number}</td>
                      <td className="py-2 px-3 text-foreground">{o.customer_name || '—'}</td>
                      <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{o.order_date ? format(new Date(o.order_date), 'dd MMM') : '—'}</td>
                      <td className="py-2 px-3"><StatusBadge status={o.woo_status || 'processing'} /></td>
                      <td className="py-2 px-3 font-mono text-xs text-right">{o.total_amount ? `$${Number(o.total_amount).toFixed(2)}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Paginator
              page={ordersPage}
              totalPages={Math.ceil((stats?.todayProcessing || []).length / PAGE_SIZE)}
              onPrev={() => setOrdersPage(p => Math.max(1, p - 1))}
              onNext={() => setOrdersPage(p => Math.min(Math.ceil((stats?.todayProcessing || []).length / PAGE_SIZE), p + 1))}
            />
          </>
        )}
      </div>

      {/* Manufacturer Inbound — Next Expected */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Ship className="w-4 h-4 text-info" /> Manufacturer Inbound</h2>
          <button onClick={() => navigate('/supplier-manifests')} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></button>
        </div>
        {(stats?.manifests || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No inbound manifests expected</p>
        ) : (
          <div className="space-y-2">
            {stats!.manifests.map((m: any) => (
              <div key={m.id} onClick={() => navigate('/supplier-manifests')} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50 cursor-pointer hover:bg-muted/50 transition-colors">
                <div>
                  <p className="text-sm font-medium text-foreground">{m.manufacturer_name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{m.manifest_number || '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  {m.eta && <span className="text-xs text-muted-foreground">ETA {format(new Date(m.eta), 'dd MMM')}</span>}
                  {m.tracking_number && <span className="text-xs font-mono text-muted-foreground">{m.tracking_number}</span>}
                  <StatusBadge status={m.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Exceptions */}
      <div className="bg-card border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Active Exceptions
            <span className="text-xs font-normal text-muted-foreground">({stats?.exceptions || 0} total open)</span>
          </h2>
          <button onClick={() => navigate('/exceptions')} className="text-xs text-primary hover:underline flex items-center gap-1">View all <ArrowRight className="w-3 h-3" /></button>
        </div>
        {(stats?.oldestExceptions || []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No active exceptions 🎉</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                    <SortHeader label="Order" sortKey="orders.order_number" current={exceptionsSort} onSort={toggleSort(setExceptionsSort, setExceptionsPage)} className="text-left" />
                    <SortHeader label="Customer" sortKey="orders.customer_name" current={exceptionsSort} onSort={toggleSort(setExceptionsSort, setExceptionsPage)} className="text-left" />
                    <SortHeader label="Order Date" sortKey="orders.order_date" current={exceptionsSort} onSort={toggleSort(setExceptionsSort, setExceptionsPage)} className="text-left" />
                    <SortHeader label="Reason" sortKey="reason" current={exceptionsSort} onSort={toggleSort(setExceptionsSort, setExceptionsPage)} className="text-left" />
                    <th className="text-left py-2 px-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortRows(stats!.oldestExceptions, exceptionsSort).slice((exceptionsPage - 1) * PAGE_SIZE, exceptionsPage * PAGE_SIZE).map((exc: any) => {
                    const order = exc.orders;
                    return (
                      <tr key={exc.id} onClick={() => navigate('/exceptions')} className="border-b border-border/30 hover:bg-muted/20 cursor-pointer transition-colors">
                        <td className="py-2 px-3 font-mono text-primary font-medium">{order?.order_number || '—'}</td>
                        <td className="py-2 px-3 text-foreground">{order?.customer_name || '—'}</td>
                        <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{order?.order_date ? format(new Date(order.order_date), 'dd MMM yyyy') : '—'}</td>
                        <td className="py-2 px-3">{exc.reason ? <StatusBadge status={exc.reason} /> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        <td className="py-2 px-3"><StatusBadge status={exc.status} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Paginator
              page={exceptionsPage}
              totalPages={Math.ceil((stats?.oldestExceptions || []).length / PAGE_SIZE)}
              onPrev={() => setExceptionsPage(p => Math.max(1, p - 1))}
              onNext={() => setExceptionsPage(p => Math.min(Math.ceil((stats?.oldestExceptions || []).length / PAGE_SIZE), p + 1))}
            />
          </>
        )}
      </div>
    </div>
  );
}

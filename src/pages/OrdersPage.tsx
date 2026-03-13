import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import KpiCard from "@/components/KpiCard";
import { useOrders } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { Package, Search, ArrowUpDown, ArrowUp, ArrowDown, Clock, CheckCircle, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortField = "order_date" | "order_number" | "customer_name";
type SortDir = "asc" | "desc";

export default function OrdersPage() {
  const [search, setSearch] = useState("");
  const [wooFilter, setWooFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("order_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { data: orders = [], isLoading } = useOrders();
  const isMobile = useIsMobile();

  const wooStatuses = useMemo(() => {
    const set = new Set(orders.map(o => o.woo_status).filter(Boolean));
    return [...set].sort();
  }, [orders]);

  const statuses = useMemo(() => {
    const set = new Set(orders.map(o => o.status).filter(Boolean));
    return [...set].sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let result = orders;

    if (search) {
      const q = search.toLowerCase();
      result = result.filter(o =>
        o.order_number.toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.customer_email || '').toLowerCase().includes(q)
      );
    }

    if (wooFilter !== "all") {
      result = result.filter(o => o.woo_status === wooFilter);
    }

    if (statusFilter !== "all") {
      result = result.filter(o => o.status === statusFilter);
    }

    result = [...result].sort((a, b) => {
      let cmp = 0;
      if (sortField === "order_date") {
        const da = a.order_date ? new Date(a.order_date).getTime() : 0;
        const db = b.order_date ? new Date(b.order_date).getTime() : 0;
        cmp = da - db;
      } else if (sortField === "order_number") {
        cmp = a.order_number.localeCompare(b.order_number, undefined, { numeric: true });
      } else if (sortField === "customer_name") {
        cmp = (a.customer_name || '').localeCompare(b.customer_name || '');
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return result;
  }, [orders, search, wooFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir(field === "order_date" ? "desc" : "asc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === "asc"
      ? <ArrowUp className="w-3 h-3 ml-1 text-primary" />
      : <ArrowDown className="w-3 h-3 ml-1 text-primary" />;
  };

  if (!currentCompany) return <EmptyState icon={Package} title="No company selected" description="Create or join a company to view orders." />;

  const orderCounts = useMemo(() => ({
    processing: orders.filter(o => o.woo_status === 'processing' || o.status === 'processing').length,
    completed: orders.filter(o => o.woo_status === 'completed' || o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered').length,
    onHold: orders.filter(o => o.woo_status === 'on-hold' || o.status === 'on-hold').length,
    cancelled: orders.filter(o => o.woo_status === 'cancelled' || o.woo_status === 'refunded' || o.status === 'cancelled').length,
  }), [orders]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Master Orders</h1>
        <p className="text-sm text-muted-foreground">{orders.length} orders · Click any row for detail view</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Processing" value={orderCounts.processing} icon={Clock} variant="info" />
        <KpiCard title="Completed" value={orderCounts.completed} icon={CheckCircle} variant="success" />
        <KpiCard title="On Hold" value={orderCounts.onHold} icon={AlertTriangle} variant="warning" />
        <KpiCard title="Cancelled / Refunded" value={orderCounts.cancelled} icon={Package} variant="danger" />
      </div>

      {/* Filters row */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search orders..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Select value={wooFilter} onValueChange={setWooFilter}>
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-card">
              <SelectValue placeholder="Woo Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Woo Status</SelectItem>
              {wooStatuses.map(s => (
                <SelectItem key={s} value={s!}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] sm:w-[160px] bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {statuses.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(wooFilter !== "all" || statusFilter !== "all" || search) && (
            <button
              onClick={() => { setWooFilter("all"); setStatusFilter("all"); setSearch(""); }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors underline"
            >
              Clear filters
            </button>
          )}
        </div>

        <span className="text-xs text-muted-foreground sm:ml-auto">
          Showing {filtered.length} of {orders.length}
        </span>
      </div>

      {isLoading ? <LoadingSpinner message="Loading orders..." /> : filtered.length === 0 ? (
        <EmptyState icon={Package} title="No orders found" description={search || wooFilter !== "all" || statusFilter !== "all" ? "Try adjusting your filters." : "Orders will appear here once data is imported."} />
      ) : isMobile ? (
        /* Mobile card view */
        <div className="space-y-2">
          {filtered.map(order => (
            <div
              key={order.id}
              onClick={() => navigate(`/orders/${order.order_number}`)}
              className="bg-card border border-border rounded-lg p-3 active:bg-muted/30 transition-colors cursor-pointer"
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-mono text-primary font-medium text-sm">{order.order_number}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}
                </span>
              </div>
              <p className="text-sm text-foreground truncate">{order.customer_name || '—'}</p>
              {order.customer_email && (
                <p className="text-xs text-muted-foreground truncate">{order.customer_email}</p>
              )}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={order.woo_status || 'processing'} />
                <StatusBadge status={order.status} />
                {order.source && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{order.source}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Desktop table view */
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th
                    className="text-left py-3 px-4 cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort("order_number")}
                  >
                    <span className="flex items-center">Order <SortIcon field="order_number" /></span>
                  </th>
                  <th
                    className="text-left py-3 px-4 cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort("order_date")}
                  >
                    <span className="flex items-center">Date <SortIcon field="order_date" /></span>
                  </th>
                  <th
                    className="text-left py-3 px-4 cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => toggleSort("customer_name")}
                  >
                    <span className="flex items-center">Customer <SortIcon field="customer_name" /></span>
                  </th>
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
                      {order.order_items?.map((i: any) => `${i.sku || '?'} ×${i.quantity}`).join(', ') || '—'}
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
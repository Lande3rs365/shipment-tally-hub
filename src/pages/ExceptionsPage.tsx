import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { AlertTriangle, CheckCircle, Phone, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

const REASON_OPTIONS = [
  { value: "oos", label: "OOS", color: "bg-destructive/15 text-destructive" },
  { value: "refund_req", label: "Refund Req", color: "bg-orange-500/15 text-orange-600" },
  { value: "cancellation_req", label: "Cancel Req", color: "bg-red-500/15 text-red-600" },
  { value: "need_shipping_dets", label: "Need Ship Dets", color: "bg-blue-500/15 text-blue-600" },
  { value: "returned_item", label: "Returned Item", color: "bg-purple-500/15 text-purple-600" },
  { value: "customs", label: "Customs", color: "bg-amber-500/15 text-amber-700" },
  { value: "apac_order", label: "APAC Order", color: "bg-teal-500/15 text-teal-600" },
  { value: "other", label: "Other", color: "bg-muted text-muted-foreground" },
];

const getReasonMeta = (reason: string | null) =>
  REASON_OPTIONS.find(r => r.value === reason) || null;

const getOrderNumberColor = (wooStatus: string | null | undefined): string => {
  switch (wooStatus) {
    case "processing": return "text-blue-600";
    case "completed": return "text-green-600";
    case "refunded":
    case "cancelled": return "text-red-600";
    case "on-hold": return "text-orange-500";
    default: return "text-primary";
  }
};

const formatDate = (d: string | null) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
};

type SortKey = "order_date" | "contacted" | "reason" | "status";
type SortDir = "asc" | "desc";

const SortIcon = ({ column, activeCol, activeDir }: { column: SortKey; activeCol: SortKey | null; activeDir: SortDir }) => {
  if (activeCol !== column) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
  return activeDir === "asc"
    ? <ArrowUp className="w-3 h-3 ml-1" />
    : <ArrowDown className="w-3 h-3 ml-1" />;
};

export default function ExceptionsPage() {
  const { currentCompany } = useCompany();
  const { data: exceptions = [], isLoading } = useExceptions();
  const [sortCol, setSortCol] = useState<SortKey | null>("order_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const toggleSort = (col: SortKey) => {
    if (sortCol === col) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const active = useMemo(() =>
    exceptions.filter(e => e.status !== "resolved" && e.status !== "dismissed"),
    [exceptions]
  );
  const resolved = useMemo(() =>
    exceptions.filter(e => e.status === "resolved" || e.status === "dismissed"),
    [exceptions]
  );

  const applySorting = (items: typeof active) => {
    if (!sortCol) return items;
    const sorted = [...items].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "order_date": {
          const dA = a.orders?.order_date || a.created_at;
          const dB = b.orders?.order_date || b.created_at;
          cmp = new Date(dA).getTime() - new Date(dB).getTime();
          break;
        }
        case "contacted":
          cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case "reason":
          cmp = (a.reason || "zzz").localeCompare(b.reason || "zzz");
          break;
        case "status": {
          const sA = a.exception_type === "on_hold" ? "on_hold" : a.status;
          const sB = b.exception_type === "on_hold" ? "on_hold" : b.status;
          cmp = sA.localeCompare(sB);
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return sorted;
  };

  const sortedActive = useMemo(() => {
    const onHold = active.filter(e => e.exception_type === "on_hold");
    const other = active.filter(e => e.exception_type !== "on_hold");
    return { onHold: applySorting(onHold), other: applySorting(other) };
  }, [active, sortCol, sortDir]);

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  const renderSortableHeader = () => (
    <TableRow className="bg-muted/50">
      <TableHead className="w-[340px]">Order</TableHead>
      <TableHead
        className="w-[150px] text-center cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => toggleSort("order_date")}
      >
        <span className="inline-flex items-center justify-center">
          Order Date <SortIcon column="order_date" activeCol={sortCol} activeDir={sortDir} />
        </span>
      </TableHead>
      <TableHead
        className="w-[150px] text-center cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => toggleSort("contacted")}
      >
        <span className="inline-flex items-center justify-center">
          Contacted <SortIcon column="contacted" activeCol={sortCol} activeDir={sortDir} />
        </span>
      </TableHead>
      <TableHead
        className="w-[200px] cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => toggleSort("reason")}
      >
        <span className="inline-flex items-center">
          Reason <SortIcon column="reason" activeCol={sortCol} activeDir={sortDir} />
        </span>
      </TableHead>
      <TableHead
        className="w-[140px] text-center cursor-pointer select-none hover:text-foreground transition-colors"
        onClick={() => toggleSort("status")}
      >
        <span className="inline-flex items-center justify-center">
          Status <SortIcon column="status" activeCol={sortCol} activeDir={sortDir} />
        </span>
      </TableHead>
    </TableRow>
  );

  const renderRow = (exc: typeof exceptions[0]) => {
    const orderNumber = exc.orders?.order_number;
    const wooStatus = exc.orders?.woo_status;
    const reasonMeta = getReasonMeta(exc.reason);
    const orderDate = exc.orders?.order_date;
    const isOnHold = exc.exception_type === "on_hold";

    return (
      <TableRow key={exc.id}>
        <TableCell className="py-3">
          <div className="flex items-center gap-2 min-w-0">
            {orderNumber ? (
              <Link
                to={`/orders/${orderNumber}`}
                className={cn("font-mono text-sm font-bold hover:underline shrink-0", getOrderNumberColor(wooStatus))}
              >
                {orderNumber}
              </Link>
            ) : (
              <span className="font-mono text-sm font-bold text-foreground shrink-0">{exc.title}</span>
            )}
            {exc.orders?.customer_name && (
              <span className="text-sm text-muted-foreground truncate">{exc.orders.customer_name}</span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center text-xs text-muted-foreground py-3">
          {orderDate ? formatDate(orderDate) : "—"}
        </TableCell>
        <TableCell className="text-center text-xs text-muted-foreground py-3">
          {formatDate(exc.created_at)}
        </TableCell>
        <TableCell className="py-3">
          {reasonMeta ? (
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full inline-block", reasonMeta.color)}>
              {reasonMeta.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-center py-3">
          {isOnHold ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 inline-block">
              On Hold
            </span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 inline-block">
              Active
            </span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-end gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <Badge variant="outline" className="text-xs font-medium border-amber-500/40 text-amber-600">
          {sortedActive.onHold.length} On Hold
        </Badge>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading exceptions..." />
      ) : active.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Exceptions will appear here when issues are detected." />
      ) : (
        <div className="space-y-6">
          {sortedActive.onHold.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> On-Hold Orders — Follow Up Required ({sortedActive.onHold.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>{renderSortableHeader()}</TableHeader>
                  <TableBody>{sortedActive.onHold.map(exc => renderRow(exc))}</TableBody>
                </Table>
              </div>
            </div>
          )}

          {sortedActive.other.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Other Exceptions ({sortedActive.other.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>{renderSortableHeader()}</TableHeader>
                  <TableBody>{sortedActive.other.map(exc => renderRow(exc))}</TableBody>
                </Table>
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Resolved ({resolved.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <Table>
                  <TableHeader>{renderSortableHeader()}</TableHeader>
                  <TableBody>
                    {resolved.map(exc => {
                      const orderNumber = exc.orders?.order_number;
                      const wooStatus = exc.orders?.woo_status;
                      const reasonMeta = getReasonMeta(exc.reason);
                      return (
                        <TableRow key={exc.id} className="opacity-50">
                          <TableCell className="py-2.5">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              {orderNumber ? (
                                <Link to={`/orders/${orderNumber}`} className={cn("font-mono text-sm hover:underline", getOrderNumberColor(wooStatus))}>
                                  {orderNumber}
                                </Link>
                              ) : (
                                <span className="font-mono text-sm">{exc.title}</span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {exc.orders?.order_date ? formatDate(exc.orders.order_date) : "—"}
                          </TableCell>
                          <TableCell className="text-center text-xs text-muted-foreground">
                            {formatDate(exc.created_at)}
                          </TableCell>
                          <TableCell>
                            {reasonMeta ? (
                              <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full inline-block", reasonMeta.color)}>
                                {reasonMeta.label}
                              </span>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 inline-block">
                              Resolved
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

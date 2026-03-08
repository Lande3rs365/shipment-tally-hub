import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Phone, Eye } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const db = supabase as any;

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

const getStatusPill = (exc: { exception_type: string; status: string }) => {
  if (exc.exception_type === "on_hold") {
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 whitespace-nowrap">On Hold</span>;
  }
  if (exc.status === "open") {
    return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 whitespace-nowrap">Active</span>;
  }
  return <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-muted-foreground whitespace-nowrap">{exc.status}</span>;
};

// 5 columns: Order 340px | Order Date 150px | Contacted 150px | Reason 200px | Status 140px
const GRID = "grid grid-cols-[340px_150px_150px_200px_140px] items-center";

export default function ExceptionsPage() {
  const { currentCompany } = useCompany();
  const { data: exceptions = [], isLoading } = useExceptions();
  const queryClient = useQueryClient();

  const active = useMemo(() =>
    exceptions.filter(e => e.status !== 'resolved' && e.status !== 'dismissed'),
    [exceptions]
  );
  const resolved = useMemo(() =>
    exceptions.filter(e => e.status === 'resolved' || e.status === 'dismissed'),
    [exceptions]
  );

  const sortedActive = useMemo(() => {
    const onHold = active.filter(e => e.exception_type === 'on_hold');
    const other = active.filter(e => e.exception_type !== 'on_hold');

    const sortFn = (a: typeof active[0], b: typeof active[0]) => {
      const dateA = a.orders?.order_date || a.created_at;
      const dateB = b.orders?.order_date || b.created_at;
      const cmp1 = new Date(dateA).getTime() - new Date(dateB).getTime();
      if (cmp1 !== 0) return cmp1;
      const cmp2 = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      if (cmp2 !== 0) return cmp2;
      return (a.reason || '').localeCompare(b.reason || '');
    };

    return { onHold: [...onHold].sort(sortFn), other: [...other].sort(sortFn) };
  }, [active]);

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  const renderRow = (exc: typeof exceptions[0]) => {
    const orderNumber = exc.orders?.order_number;
    const wooStatus = exc.orders?.woo_status;
    const reasonMeta = getReasonMeta(exc.reason);
    const orderDate = exc.orders?.order_date;
    const contactedDate = exc.created_at;

    return (
      <div key={exc.id} className={cn(GRID, "bg-card border border-border rounded-lg px-4 py-3")}>
        {/* Order — left aligned */}
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2">
            {orderNumber ? (
              <Link
                to={`/orders/${orderNumber}`}
                className={cn("font-mono text-sm font-semibold hover:underline shrink-0", getOrderNumberColor(wooStatus))}
              >
                {orderNumber}
              </Link>
            ) : (
              <span className="font-mono text-sm font-semibold text-foreground shrink-0">{exc.title}</span>
            )}
            {orderNumber && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground" asChild>
                <Link to={`/orders/${orderNumber}`}>
                  <Eye className="w-3 h-3" />
                </Link>
              </Button>
            )}
          </div>
          {exc.orders?.customer_name && (
            <span className="text-xs text-muted-foreground truncate">{exc.orders.customer_name}</span>
          )}
        </div>

        {/* Order Date — center */}
        <span className="text-xs text-muted-foreground text-center">
          {orderDate ? formatDate(orderDate) : "—"}
        </span>

        {/* Contacted — center */}
        <span className="text-xs text-muted-foreground text-center">
          {formatDate(contactedDate)}
        </span>

        {/* Reason — read-only pill, left aligned */}
        <div>
          {reasonMeta ? (
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full", reasonMeta.color)}>
              {reasonMeta.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Status — centered pill */}
        <div className="flex justify-center">
          {getStatusPill(exc)}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-end gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-xs font-medium">
            {active.length} Active
          </Badge>
          <Badge variant="outline" className="text-xs font-medium border-amber-500/40 text-amber-600">
            {sortedActive.onHold.length} On Hold
          </Badge>
          <Badge variant="outline" className="text-xs font-medium border-green-500/40 text-green-600">
            {resolved.length} Resolved
          </Badge>
        </div>
      </div>

      {isLoading ? (
        <LoadingSpinner message="Loading exceptions..." />
      ) : active.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Exceptions will appear here when issues are detected." />
      ) : (
        <div className="space-y-5 overflow-x-auto">
          {/* Column headers */}
          <div className={cn(GRID, "px-4 text-xs font-medium text-muted-foreground uppercase tracking-wider")}>
            <span>Order</span>
            <span className="text-center">Order Date</span>
            <span className="text-center">Contacted</span>
            <span>Reason</span>
            <span className="text-center">Status</span>
          </div>

          {/* On-Hold section */}
          {sortedActive.onHold.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> On-Hold Orders — Follow Up Required ({sortedActive.onHold.length})
              </h3>
              <div className="space-y-1.5">
                {sortedActive.onHold.map(exc => renderRow(exc))}
              </div>
            </div>
          )}

          {/* Other exceptions */}
          {sortedActive.other.length > 0 && (
            <div>
              {sortedActive.onHold.length > 0 && (
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Other Exceptions ({sortedActive.other.length})
                </h3>
              )}
              <div className="space-y-1.5">
                {sortedActive.other.map(exc => renderRow(exc))}
              </div>
            </div>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground pt-4 mb-3">
                Resolved ({resolved.length})
              </h3>
              <div className="space-y-1">
                {resolved.map(exc => {
                  const reasonMeta = getReasonMeta(exc.reason);
                  const orderNumber = exc.orders?.order_number;
                  const wooStatus = exc.orders?.woo_status;
                  return (
                    <div key={exc.id} className="bg-card border border-border/50 rounded-lg px-4 py-2.5 opacity-50 flex items-center gap-3">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      {reasonMeta && (
                        <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full", reasonMeta.color)}>
                          {reasonMeta.label}
                        </span>
                      )}
                      {orderNumber ? (
                        <Link to={`/orders/${orderNumber}`} className={cn("font-mono text-sm hover:underline", getOrderNumberColor(wooStatus))}>
                          {orderNumber}
                        </Link>
                      ) : (
                        <span className="font-mono text-sm">{exc.title}</span>
                      )}
                      {exc.resolution_notes && (
                        <span className="text-xs text-muted-foreground ml-auto">{exc.resolution_notes}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

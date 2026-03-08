import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock, Phone, Eye, Tag } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

const db = supabase as any;

const STATUS_OPTIONS = [
  { value: "processing", label: "Processing" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
];

const REASON_OPTIONS = [
  { value: "oos", label: "OOS", color: "bg-destructive/15 text-destructive" },
  { value: "refund_req", label: "Refund Req", color: "bg-orange-500/15 text-orange-600" },
  { value: "cancellation_req", label: "Cancellation Req", color: "bg-red-500/15 text-red-600" },
  { value: "need_shipping_dets", label: "Need Shipping Dets", color: "bg-blue-500/15 text-blue-600" },
  { value: "returned_item", label: "Returned Item", color: "bg-purple-500/15 text-purple-600" },
  { value: "customs", label: "Customs", color: "bg-amber-500/15 text-amber-700" },
  { value: "apac_order", label: "APAC Order", color: "bg-teal-500/15 text-teal-600" },
  { value: "other", label: "Other", color: "bg-muted text-muted-foreground" },
];

const getReasonMeta = (reason: string | null) =>
  REASON_OPTIONS.find(r => r.value === reason) || null;

/** Map woo_status to order number text color */
const getOrderNumberColor = (wooStatus: string | null | undefined): string => {
  switch (wooStatus) {
    case "processing":
      return "text-blue-600";
    case "completed":
      return "text-green-600";
    case "refunded":
    case "cancelled":
      return "text-red-600";
    case "on-hold":
      return "text-orange-500";
    default:
      return "text-primary";
  }
};

export default function ExceptionsPage() {
  const { currentCompany } = useCompany();
  const { data: exceptions = [], isLoading } = useExceptions();
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const active = exceptions.filter(e => e.status !== 'resolved' && e.status !== 'dismissed');
  const resolved = exceptions.filter(e => e.status === 'resolved' || e.status === 'dismissed');

  const onHold = active.filter(e => e.exception_type === 'on_hold');
  const other = active.filter(e => e.exception_type !== 'on_hold');

  const handleStatusChange = async (exc: typeof exceptions[0], newWooStatus: string) => {
    setUpdatingId(exc.id);
    try {
      if (exc.linked_order_id) {
        const { error: orderErr } = await db
          .from('orders')
          .update({ woo_status: newWooStatus })
          .eq('id', exc.linked_order_id);
        if (orderErr) throw orderErr;
      }

      if (newWooStatus !== 'on-hold') {
        const { error } = await db
          .from('exceptions')
          .update({
            status: 'resolved',
            resolved_at: new Date().toISOString(),
            resolution_notes: `Status changed to ${newWooStatus}`,
          })
          .eq('id', exc.id);
        if (error) throw error;
      }

      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast({ title: `Status → ${newWooStatus}` });
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    }
    setUpdatingId(null);
  };

  const handleReasonChange = async (excId: string, reason: string) => {
    try {
      const { error } = await db
        .from('exceptions')
        .update({ reason })
        .eq('id', excId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      const label = REASON_OPTIONS.find(r => r.value === reason)?.label || reason;
      toast({ title: `Reason set: ${label}` });
    } catch (err: any) {
      toast({ title: 'Failed to set reason', description: err.message, variant: 'destructive' });
    }
  };

  const handleSnooze = async (id: string) => {
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const { error } = await db
        .from('exceptions')
        .update({ follow_up_due_at: nextWeek.toISOString() })
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      toast({ title: 'Snoozed 7 days' });
    } catch (err: any) {
      toast({ title: 'Failed to snooze', description: err.message, variant: 'destructive' });
    }
  };

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const renderExceptionRow = (exc: typeof exceptions[0], isOnHold: boolean) => {
    const followUpDue = exc.follow_up_due_at;
    const isOverdue = followUpDue && new Date(followUpDue) < new Date();
    const orderNumber = exc.orders?.order_number;
    const wooStatus = exc.orders?.woo_status;
    const reasonMeta = getReasonMeta(exc.reason);
    const contactedDate = exc.created_at;
    const orderDate = exc.orders?.order_date;

    return (
      <div
        key={exc.id}
        className={cn(
          "bg-card border rounded-lg px-4 py-3",
          isOverdue ? "border-destructive/60" : "border-border"
        )}
      >
        {/* Row 1: Order#, Customer, Severity, Overdue badge */}
        <div className="flex items-center justify-between gap-3 mb-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-wrap">
            {orderNumber ? (
              <Link
                to={`/orders/${orderNumber}`}
                className={cn("font-mono text-sm font-semibold hover:underline", getOrderNumberColor(wooStatus))}
              >
                {orderNumber}
              </Link>
            ) : (
              <span className="font-mono text-sm font-semibold text-foreground">{exc.title}</span>
            )}
            {exc.orders?.customer_name && (
              <span className="text-sm text-muted-foreground">{exc.orders.customer_name}</span>
            )}
            <StatusBadge status={exc.severity} />
            {isOverdue && (
              <span className="text-xs text-destructive font-medium px-2 py-0.5 bg-destructive/10 rounded">
                Overdue
              </span>
            )}
          </div>

          {/* Right side: actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Reason pill / setter */}
            {reasonMeta ? (
              <Select onValueChange={(val) => handleReasonChange(exc.id, val)}>
                <SelectTrigger className="h-7 w-auto border-0 p-0 shadow-none focus:ring-0">
                  <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full cursor-pointer", reasonMeta.color)}>
                    {reasonMeta.label}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <Select onValueChange={(val) => handleReasonChange(exc.id, val)}>
                <SelectTrigger className="h-7 w-[110px] text-xs border-dashed text-muted-foreground">
                  <Tag className="w-3 h-3 mr-1 shrink-0" />
                  <SelectValue placeholder="Set reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASON_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {orderNumber && (
              <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                <Link to={`/orders/${orderNumber}`}>
                  <Eye className="w-3 h-3 mr-1" /> View
                </Link>
              </Button>
            )}

            <Select
              onValueChange={(val) => handleStatusChange(exc, val)}
              disabled={updatingId === exc.id}
            >
              <SelectTrigger className="h-7 w-[120px] text-xs">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Dates */}
        <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <span>Customer contacted: {formatDate(contactedDate)}</span>
          {orderDate && <span>Order date: {formatDate(orderDate)}</span>}
          {followUpDue && !isOverdue && isOnHold && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> Follow-up: {formatDate(followUpDue)}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <p className="text-sm text-muted-foreground">
          {active.length} active · {onHold.length} on-hold · {resolved.length} resolved
        </p>
      </div>

      {isLoading ? <LoadingSpinner message="Loading exceptions..." /> : active.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Exceptions will appear here when issues are detected." />
      ) : (
        <div className="space-y-6">
          {onHold.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> On-Hold Orders — Follow Up Required ({onHold.length})
              </h3>
              <div className="space-y-2">
                {onHold.map(exc => renderExceptionRow(exc, true))}
              </div>
            </div>
          )}

          {other.length > 0 && (
            <div>
              {onHold.length > 0 && (
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  Other Exceptions ({other.length})
                </h3>
              )}
              <div className="space-y-2">
                {other.map(exc => renderExceptionRow(exc, false))}
              </div>
            </div>
          )}

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

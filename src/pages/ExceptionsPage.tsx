import { useState } from "react";
import { Link } from "react-router-dom";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock, Phone, Eye, ChevronDown } from "lucide-react";
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
      // Update order woo_status
      if (exc.linked_order_id) {
        const { error: orderErr } = await db
          .from('orders')
          .update({ woo_status: newWooStatus })
          .eq('id', exc.linked_order_id);
        if (orderErr) throw orderErr;
      }

      // If not on-hold, resolve the exception (moves it out of queue)
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
      toast({ title: `Status updated to ${newWooStatus}` });
    } catch (err: any) {
      console.error('Failed to update status:', err);
      toast({ title: 'Failed to update', description: err.message, variant: 'destructive' });
    }
    setUpdatingId(null);
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
      toast({ title: 'Snoozed 7 days', description: 'Follow-up date updated.' });
    } catch (err: any) {
      console.error('Failed to snooze exception:', err);
      toast({ title: 'Failed to snooze', description: err.message, variant: 'destructive' });
    }
  };

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  const renderExceptionCard = (exc: typeof exceptions[0], isOnHold: boolean) => {
    const followUpDue = exc.follow_up_due_at;
    const isOverdue = followUpDue && new Date(followUpDue) < new Date();
    const orderNumber = exc.orders?.order_number;

    return (
      <div
        key={exc.id}
        className={cn(
          "bg-card border rounded-lg p-4",
          isOverdue ? "border-destructive" : "border-border"
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            <AlertTriangle className={cn(
              "w-4 h-4 mt-0.5 shrink-0",
              isOverdue ? "text-destructive" : isOnHold ? "text-warning" : "text-destructive"
            )} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-mono text-sm text-primary">{exc.title}</span>
                <StatusBadge status={exc.severity} />
                {!isOnHold && (
                  <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
                    {exc.exception_type}
                  </span>
                )}
                {isOverdue && (
                  <span className="text-xs text-destructive font-medium px-2 py-0.5 bg-destructive/10 rounded">
                    Follow-up overdue
                  </span>
                )}
                {followUpDue && !isOverdue && isOnHold && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Due {new Date(followUpDue).toLocaleDateString()}
                  </span>
                )}
              </div>
              <p className="text-sm text-foreground">{exc.description}</p>
              {orderNumber && (
                <p className="text-xs text-muted-foreground mt-1">
                  Order: <span className="font-mono text-primary">{orderNumber}</span>
                  {exc.orders?.customer_name && ` · ${exc.orders.customer_name}`}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* View Order Button */}
            {orderNumber && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/orders/${orderNumber}`}>
                  <Eye className="w-3.5 h-3.5 mr-1" /> View
                </Link>
              </Button>
            )}

            {/* Snooze (on-hold only) */}
            {isOnHold && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleSnooze(exc.id)}
                className="text-muted-foreground"
              >
                Snooze 7d
              </Button>
            )}

            {/* Status Change Dropdown */}
            <Select
              onValueChange={(val) => handleStatusChange(exc, val)}
              disabled={updatingId === exc.id}
            >
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
          {/* On-Hold Section */}
          {onHold.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> On-Hold Orders — Follow Up Required
              </h3>
              <div className="space-y-3">
                {onHold.map(exc => renderExceptionCard(exc, true))}
              </div>
            </div>
          )}

          {/* Other Exceptions */}
          {other.length > 0 && (
            <div>
              {onHold.length > 0 && (
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Other Exceptions</h3>
              )}
              <div className="space-y-3">
                {other.map(exc => renderExceptionCard(exc, false))}
              </div>
            </div>
          )}

          {/* Resolved */}
          {resolved.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground pt-4 mb-3">Resolved</h3>
              <div className="space-y-2">
                {resolved.map(exc => (
                  <div key={exc.id} className="bg-card border border-border/50 rounded-lg p-4 opacity-60">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-success" />
                      <span className="font-mono text-sm">{exc.title}</span>
                      <span className="text-xs text-muted-foreground">{exc.description}</span>
                      {exc.resolution_notes && (
                        <span className="text-xs text-muted-foreground ml-auto">{exc.resolution_notes}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

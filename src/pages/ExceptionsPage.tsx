import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Clock, Phone } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

export default function ExceptionsPage() {
  const { currentCompany } = useCompany();
  const { data: exceptions = [], isLoading } = useExceptions();
  const queryClient = useQueryClient();

  const active = exceptions.filter(e => e.status !== 'resolved' && e.status !== 'dismissed');
  const resolved = exceptions.filter(e => e.status === 'resolved' || e.status === 'dismissed');

  // Separate on-hold from other exceptions
  const onHold = active.filter(e => e.exception_type === 'on_hold');
  const other = active.filter(e => e.exception_type !== 'on_hold');

  const handleResolve = async (id: string) => {
    try {
      const { error } = await (supabase as any)
        .from('exceptions')
        .update({ status: 'resolved', resolved_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });
      toast({ title: 'Exception resolved' });
    } catch (err: any) {
      console.error('Failed to resolve exception:', err);
      toast({ title: 'Failed to resolve', description: err.message, variant: 'destructive' });
    }
  };

  const handleSnooze = async (id: string) => {
    try {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      const { error } = await (supabase as any)
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

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <p className="text-sm text-muted-foreground">{active.length} active · {onHold.length} on-hold · {resolved.length} resolved</p>
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
                {onHold.map(exc => {
                  const followUpDue = (exc as any).follow_up_due_at;
                  const isOverdue = followUpDue && new Date(followUpDue) < new Date();

                  return (
                    <div key={exc.id} className={cn(
                      "bg-card border rounded-lg p-4",
                      isOverdue ? "border-destructive" : "border-border"
                    )}>
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3">
                          <AlertTriangle className={cn("w-4 h-4 mt-0.5 shrink-0", isOverdue ? "text-destructive" : "text-warning")} />
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-mono text-sm text-primary">{exc.title}</span>
                              <StatusBadge status={exc.severity} />
                              {isOverdue && (
                                <span className="text-xs text-destructive font-medium px-2 py-0.5 bg-destructive/10 rounded">
                                  Follow-up overdue
                                </span>
                              )}
                              {followUpDue && !isOverdue && (
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Clock className="w-3 h-3" /> Due {new Date(followUpDue).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-foreground">{exc.description}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          <button
                            onClick={() => handleSnooze(exc.id)}
                            className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-accent transition-colors"
                          >
                            Snooze 7d
                          </button>
                          <button
                            onClick={() => handleResolve(exc.id)}
                            className="px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                          >
                            Resolve
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                {other.map(exc => (
                  <div key={exc.id} className="bg-card border border-border rounded-lg p-4 flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-sm text-primary">{exc.title}</span>
                          <StatusBadge status={exc.severity} />
                          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">{exc.exception_type}</span>
                        </div>
                        <p className="text-sm text-foreground">{exc.description}</p>
                      </div>
                    </div>
                    <button onClick={() => handleResolve(exc.id)} className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-accent transition-colors">
                      Resolve
                    </button>
                  </div>
                ))}
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

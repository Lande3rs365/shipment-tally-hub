import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export default function ExceptionsPage() {
  const { currentCompany } = useCompany();
  const { data: exceptions = [], isLoading } = useExceptions();
  const queryClient = useQueryClient();

  const active = exceptions.filter(e => e.status !== 'resolved' && e.status !== 'dismissed');
  const resolved = exceptions.filter(e => e.status === 'resolved' || e.status === 'dismissed');

  const handleResolve = async (id: string) => {
    await (supabase as any)
      .from('exceptions')
      .update({ status: 'resolved', resolved_at: new Date().toISOString() })
      .eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['exceptions'] });
  };

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exception Queue</h1>
        <p className="text-sm text-muted-foreground">{active.length} active · {resolved.length} resolved</p>
      </div>

      {isLoading ? <LoadingSpinner message="Loading exceptions..." /> : active.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Exceptions will appear here when issues are detected." />
      ) : (
        <div className="space-y-3">
          {active.map(exc => (
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
              <button
                onClick={() => handleResolve(exc.id)}
                className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-md hover:bg-accent transition-colors"
              >
                Resolve
              </button>
            </div>
          ))}

          {resolved.length > 0 && (
            <>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground pt-4">Resolved</h3>
              {resolved.map(exc => (
                <div key={exc.id} className="bg-card border border-border/50 rounded-lg p-4 opacity-60">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-success" />
                    <span className="font-mono text-sm">{exc.title}</span>
                    <span className="text-xs text-muted-foreground">{exc.description}</span>
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

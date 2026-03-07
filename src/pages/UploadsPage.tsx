import { Upload, FileSpreadsheet, Check } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDataIntakeLogs } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";

const sources = ['WooCommerce', 'Pirate Ship', 'ShipStation', 'Inventory / Stock'];

export default function UploadsPage() {
  const [selectedSource, setSelectedSource] = useState(sources[0]);
  const [dragOver, setDragOver] = useState(false);
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useDataIntakeLogs();

  const logUpload = useCallback(async (files: File[]) => {
    if (!currentCompany) return;
    for (const f of files) {
      await (supabase as any).from('data_intake_logs').insert({
        company_id: currentCompany.id,
        file_name: f.name,
        file_type: f.name.endsWith('.csv') ? 'csv' : 'xlsx',
        source_type: selectedSource.toLowerCase().replace(/\s+\/?\s*/g, '_'),
        status: 'completed',
        total_rows: 0,
        uploaded_by: user?.id || null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
    }
    queryClient.invalidateQueries({ queryKey: ['data_intake_logs'] });
  }, [currentCompany, selectedSource, user, queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    logUpload(files);
  }, [logUpload]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    logUpload(files);
  }, [logUpload]);

  if (!currentCompany) return <EmptyState icon={Upload} title="No company selected" />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Intake</h1>
        <p className="text-sm text-muted-foreground">Upload order, shipment, and inventory files</p>
      </div>

      {/* Source selector */}
      <div className="flex gap-2">
        {sources.map(s => (
          <button
            key={s}
            onClick={() => setSelectedSource(s)}
            className={cn(
              "px-4 py-2 rounded-md text-sm border transition-colors",
              s === selectedSource
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card"
        )}
      >
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-foreground font-medium">Drop {selectedSource} files here</p>
        <p className="text-sm text-muted-foreground mt-1">CSV or XLSX files supported</p>
        <label className="inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm cursor-pointer hover:bg-primary/90 transition-colors">
          Browse Files
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" multiple onChange={handleFileSelect} />
        </label>
      </div>

      {/* Upload history */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Recent Uploads</h2>
        {isLoading ? <LoadingSpinner message="Loading upload history..." /> : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground">No uploads yet.</p>
        ) : (
          <div className="space-y-2">
            {logs.map(u => (
              <div key={u.id} className="flex items-center justify-between p-3 rounded-md bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <FileSpreadsheet className="w-4 h-4 text-success" />
                  <div>
                    <p className="text-sm font-mono text-foreground">{u.file_name}</p>
                    <p className="text-xs text-muted-foreground">{u.source_type?.replace(/_/g, ' ')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs text-muted-foreground">
                    {new Date(u.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

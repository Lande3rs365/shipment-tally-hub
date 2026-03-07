import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Eye } from "lucide-react";
import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useDataIntakeLogs } from "@/hooks/useSupabaseData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import {
  parseWooCommerceCSV, parseShipmentCSV, parseMasterXLSX,
  readFileAsText, readFileAsArrayBuffer,
} from "@/lib/csvParsers";
import type { ParsedOrder, ParsedShipment, ParsedMasterRow } from "@/lib/csvParsers";
import {
  previewWooCommerceImport, previewShipmentImport, previewMasterImport,
  importWooCommerceOrders, importShipments, importMasterRows,
  type ImportPreview,
} from "@/lib/importHelpers";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "@/hooks/use-toast";

const db = supabase as any;

const sources = ['WooCommerce', 'Pirate Ship', 'ShipStation', 'Master XLSX', 'Inventory / Stock', 'Manufacturer Inbound'];

interface UploadProgress {
  fileName: string;
  status: "parsing" | "previewing" | "importing" | "done" | "error";
  total: number;
  processed: number;
  errors: number;
  message?: string;
}

interface PendingImport {
  fileName: string;
  sourceKey: string;
  preview: ImportPreview;
  data: ParsedOrder[] | ParsedShipment[] | ParsedMasterRow[];
  type: "woocommerce" | "shipment" | "master";
}

export default function UploadsPage() {
  const [selectedSource, setSelectedSource] = useState(sources[0]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<UploadProgress | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useDataIntakeLogs();

  const processFile = useCallback(async (file: File) => {
    if (!currentCompany || !user) return;
    const sourceKey = selectedSource.toLowerCase().replace(/\s+\/?\s*/g, "_");
    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    setUploading({ fileName: file.name, status: "parsing", total: 0, processed: 0, errors: 0 });
    setPending(null);

    try {
      if (selectedSource === "Master XLSX" || (isXlsx && selectedSource === "WooCommerce")) {
        const buffer = await readFileAsArrayBuffer(file);
        const rows = parseMasterXLSX(buffer);
        setUploading(prev => prev ? { ...prev, status: "previewing", total: rows.length } : null);
        const preview = await previewMasterImport(rows, currentCompany.id);
        setPending({ fileName: file.name, sourceKey, preview, data: rows, type: "master" });
        setUploading(null);
      } else if (selectedSource === "WooCommerce") {
        const text = await readFileAsText(file);
        const orders = parseWooCommerceCSV(text);
        setUploading(prev => prev ? { ...prev, status: "previewing", total: orders.length } : null);
        const preview = await previewWooCommerceImport(orders, currentCompany.id);
        setPending({ fileName: file.name, sourceKey, preview, data: orders, type: "woocommerce" });
        setUploading(null);
      } else if (selectedSource === "Pirate Ship" || selectedSource === "ShipStation") {
        const text = await readFileAsText(file);
        const shipments = parseShipmentCSV(text);
        setUploading(prev => prev ? { ...prev, status: "previewing", total: shipments.length } : null);
        const preview = await previewShipmentImport(shipments, currentCompany.id);
        setPending({ fileName: file.name, sourceKey, preview, data: shipments, type: "shipment" });
        setUploading(null);
      } else {
        toast({ title: "Not supported yet", description: `Parsing for "${selectedSource}" is coming soon.`, variant: "destructive" });
        setUploading(null);
      }
    } catch (err: any) {
      console.error("File processing error:", err);
      setUploading({ fileName: file.name, status: "error", total: 0, processed: 0, errors: 0, message: err.message });
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
      setTimeout(() => setUploading(null), 4000);
    }
  }, [currentCompany, selectedSource, user]);

  const confirmImport = useCallback(async () => {
    if (!pending || !currentCompany || !user) return;
    const { fileName, sourceKey, preview, data, type } = pending;
    setPending(null);
    setUploading({ fileName, status: "importing", total: preview.totalRows, processed: 0, errors: 0 });

    try {
      let result = { processed: 0, errors: 0 };
      if (type === "woocommerce") {
        result = await importWooCommerceOrders(data as ParsedOrder[], currentCompany.id, user.id);
      } else if (type === "shipment") {
        result = await importShipments(data as ParsedShipment[], currentCompany.id, user.id);
      } else if (type === "master") {
        result = await importMasterRows(data as ParsedMasterRow[], currentCompany.id, user.id);
      }

      await db.from("data_intake_logs").insert({
        company_id: currentCompany.id, file_name: fileName,
        file_type: fileName.endsWith(".csv") ? "csv" : "xlsx",
        source_type: sourceKey, status: result.errors > 0 ? "completed_with_errors" : "completed",
        total_rows: preview.totalRows, processed_rows: result.processed, error_rows: result.errors,
        uploaded_by: user.id, started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      });

      setUploading({ fileName, status: "done", total: preview.totalRows, processed: result.processed, errors: result.errors });
      queryClient.invalidateQueries({ queryKey: ["data_intake_logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });

      toast({
        title: "Import complete",
        description: `${result.processed} of ${preview.totalRows} rows imported${result.errors > 0 ? ` (${result.errors} errors)` : ""}.`,
      });
    } catch (err: any) {
      console.error("Import error:", err);
      setUploading(prev => prev ? { ...prev, status: "error", message: err.message } : null);
      toast({ title: "Import failed", description: err.message, variant: "destructive" });

      await db.from("data_intake_logs").insert({
        company_id: currentCompany.id, file_name: fileName,
        file_type: fileName.endsWith(".csv") ? "csv" : "xlsx",
        source_type: sourceKey, status: "failed", total_rows: 0,
        uploaded_by: user.id, started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
        error_details: { message: err.message },
      });
      queryClient.invalidateQueries({ queryKey: ["data_intake_logs"] });
    }

    setTimeout(() => setUploading(null), 4000);
  }, [pending, currentCompany, user, queryClient]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) processFile(files[0]);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) processFile(files[0]);
  }, [processFile]);

  if (!currentCompany) return <EmptyState icon={Upload} title="No company selected" />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Data Intake</h1>
        <p className="text-sm text-muted-foreground">Upload order, shipment, and master hub files (.csv or .xlsx)</p>
      </div>

      {/* Source selector */}
      <div className="flex gap-2 flex-wrap">
        {sources.map(s => (
          <button
            key={s}
            onClick={() => { setSelectedSource(s); setPending(null); }}
            disabled={!!uploading}
            className={cn(
              "px-4 py-2 rounded-md text-sm border transition-colors",
              s === selectedSource
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-muted-foreground border-border hover:border-primary/50",
              uploading && "opacity-50 cursor-not-allowed"
            )}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Import preview / confirmation */}
      {pending && (
        <div className="border border-info rounded-lg p-5 bg-info/5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-info" />
            <h3 className="font-semibold text-foreground">Import Preview — {pending.fileName}</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            {pending.preview.newOrders > 0 && (
              <div className="bg-card border border-border rounded p-3">
                <p className="text-xs text-muted-foreground">New Orders</p>
                <p className="text-lg font-mono font-bold text-success">{pending.preview.newOrders}</p>
              </div>
            )}
            {pending.preview.updatedOrders > 0 && (
              <div className="bg-card border border-border rounded p-3">
                <p className="text-xs text-muted-foreground">Updated Orders</p>
                <p className="text-lg font-mono font-bold text-warning">{pending.preview.updatedOrders}</p>
              </div>
            )}
            {pending.preview.newShipments > 0 && (
              <div className="bg-card border border-border rounded p-3">
                <p className="text-xs text-muted-foreground">New Shipments</p>
                <p className="text-lg font-mono font-bold text-success">{pending.preview.newShipments}</p>
              </div>
            )}
            {pending.preview.updatedShipments > 0 && (
              <div className="bg-card border border-border rounded p-3">
                <p className="text-xs text-muted-foreground">Updated Shipments</p>
                <p className="text-lg font-mono font-bold text-warning">{pending.preview.updatedShipments}</p>
              </div>
            )}
            {pending.preview.onHoldOrders > 0 && (
              <div className="bg-card border border-border rounded p-3">
                <p className="text-xs text-muted-foreground">On-Hold → Exceptions</p>
                <p className="text-lg font-mono font-bold text-destructive">{pending.preview.onHoldOrders}</p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {pending.preview.updatedOrders > 0 && "Updated orders will have their data replaced with the new file. "}
            {pending.preview.onHoldOrders > 0 && "On-hold orders will be added to the exception queue for follow-up."}
          </p>
          <div className="flex gap-2">
            <button onClick={confirmImport} className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors">
              Confirm Import ({pending.preview.totalRows} rows)
            </button>
            <button onClick={() => setPending(null)} className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className={cn(
          "border rounded-lg p-4 flex items-center gap-3",
          uploading.status === "error" ? "border-destructive bg-destructive/5" :
          uploading.status === "done" ? "border-success bg-success/5" :
          "border-primary bg-primary/5"
        )}>
          {uploading.status === "parsing" || uploading.status === "importing" || uploading.status === "previewing" ? (
            <Loader2 className="w-5 h-5 text-primary animate-spin" />
          ) : uploading.status === "done" ? (
            <Check className="w-5 h-5 text-success" />
          ) : (
            <AlertCircle className="w-5 h-5 text-destructive" />
          )}
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{uploading.fileName}</p>
            <p className="text-xs text-muted-foreground">
              {uploading.status === "parsing" && "Parsing file..."}
              {uploading.status === "previewing" && `Scanning ${uploading.total} rows for preview...`}
              {uploading.status === "importing" && `Importing ${uploading.total} rows...`}
              {uploading.status === "done" && `Done — ${uploading.processed} imported, ${uploading.errors} errors`}
              {uploading.status === "error" && (uploading.message || "Import failed")}
            </p>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-border bg-card",
          (uploading || pending) && "opacity-50 pointer-events-none"
        )}
      >
        <Upload className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-foreground font-medium">Drop {selectedSource} files here</p>
        <p className="text-sm text-muted-foreground mt-1">CSV and XLSX files supported</p>
        <label className={cn(
          "inline-block mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm cursor-pointer hover:bg-primary/90 transition-colors",
          (uploading || pending) && "pointer-events-none"
        )}>
          Browse Files
          <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={handleFileSelect} />
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
                    <p className="text-xs text-muted-foreground">
                      {u.source_type?.replace(/_/g, " ")} · {u.processed_rows}/{u.total_rows || 0} rows
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {u.status === "completed" ? (
                    <Check className="w-3.5 h-3.5 text-success" />
                  ) : u.status === "failed" ? (
                    <AlertCircle className="w-3.5 h-3.5 text-destructive" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-warning" />
                  )}
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

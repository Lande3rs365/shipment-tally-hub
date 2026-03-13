import { Upload, FileSpreadsheet, Check, AlertCircle, Loader2, Eye, AlertTriangle, Info } from "lucide-react";
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
  detectCSVSourceFromText, SOURCE_INFO,
  type DetectedSource,
} from "@/lib/csvParsers";
import type { ParsedOrder, ParsedShipment, ParsedMasterRow } from "@/lib/csvParsers";
import {
  previewWooCommerceImport, previewShipmentImport, previewMasterImport,
  importWooCommerceOrders, importShipments, importMasterRows,
  type ImportPreview, type ProgressCallback,
} from "@/lib/importHelpers";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { toast } from "@/hooks/use-toast";

const sources = ['WooCommerce', 'Pirate Ship', 'ShipStation', 'Master XLSX', 'Inventory / Stock', 'Manufacturer Inbound'];

interface UploadProgress {
  fileName: string;
  status: "parsing" | "previewing" | "importing" | "done" | "error";
  total: number;
  processed: number;
  errors: number;
  message?: string;
  errorMessages?: string[];
}

interface PendingImport {
  fileName: string;
  sourceKey: string;
  preview: ImportPreview;
  data: ParsedOrder[] | ParsedShipment[] | ParsedMasterRow[];
  type: "woocommerce" | "shipment" | "master";
  detectedSource: DetectedSource;
  selectedSource: string;
  mismatch: boolean;
  overridden: boolean;
}

interface ImportSummary {
  selectedSource: string;
  detectedSource: string;
  destinationTable: string;
  rowsImported: number;
  rowsSkipped: number;
}

export default function UploadsPage() {
  return <DataIntakeContent />;
}

export function DataIntakeContent() {
  const [selectedSource, setSelectedSource] = useState(sources[0]);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState<UploadProgress | null>(null);
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [lastSummary, setLastSummary] = useState<ImportSummary | null>(null);
  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: logs = [], isLoading } = useDataIntakeLogs();

  const MAX_FILE_SIZE_MB = 20;

  const processFile = useCallback(async (file: File) => {
    if (!currentCompany || !user) return;

    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Maximum file size is ${MAX_FILE_SIZE_MB}MB. Please split your file and re-upload.`, variant: "destructive" });
      return;
    }

    const isXlsx = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

    setUploading({ fileName: file.name, status: "parsing", total: 0, processed: 0, errors: 0 });
    setPending(null);
    setLastSummary(null);

    try {
      if (selectedSource === "Master XLSX" || (isXlsx && selectedSource === "WooCommerce")) {
        const buffer = await readFileAsArrayBuffer(file);
        const rows = parseMasterXLSX(buffer);
        setUploading(prev => prev ? { ...prev, status: "previewing", total: rows.length } : null);
        const preview = await previewMasterImport(rows, currentCompany.id);
        setPending({
          fileName: file.name, sourceKey: "master_xlsx", preview, data: rows, type: "master",
          detectedSource: "master_xlsx", selectedSource, mismatch: false, overridden: false,
        });
        setUploading(null);
      } else {
        // CSV — detect source from headers
        const text = await readFileAsText(file);
        const detected = detectCSVSourceFromText(text);
        const selectedKey = selectedSource === "Pirate Ship" || selectedSource === "ShipStation" ? "pirate_ship" : "woocommerce";
        const mismatch = detected !== "unknown" && detected !== selectedKey;

        if (selectedSource === "Pirate Ship" || selectedSource === "ShipStation" || (mismatch && detected === "pirate_ship")) {
          const shipments = parseShipmentCSV(text);
          setUploading(prev => prev ? { ...prev, status: "previewing", total: shipments.length } : null);
          const preview = await previewShipmentImport(shipments, currentCompany.id);
          const effectiveSource = mismatch && detected === "pirate_ship" ? "Pirate Ship" : selectedSource;
          setPending({
            fileName: file.name, sourceKey: "pirate_ship", preview, data: shipments, type: "shipment",
            detectedSource: detected, selectedSource, mismatch, overridden: false,
          });
          setUploading(null);
        } else if (selectedSource === "WooCommerce" || (mismatch && detected === "woocommerce")) {
          const orders = parseWooCommerceCSV(text);
          setUploading(prev => prev ? { ...prev, status: "previewing", total: orders.length } : null);
          const preview = await previewWooCommerceImport(orders, currentCompany.id);
          setPending({
            fileName: file.name, sourceKey: "woocommerce", preview, data: orders, type: "woocommerce",
            detectedSource: detected, selectedSource, mismatch, overridden: false,
          });
          setUploading(null);
        } else {
          toast({ title: "Not supported yet", description: `Parsing for "${selectedSource}" is coming soon.`, variant: "destructive" });
          setUploading(null);
        }
      }
    } catch (err: any) {
      setUploading({ fileName: file.name, status: "error", total: 0, processed: 0, errors: 0, message: err.message });
      toast({ title: "Parse failed", description: err.message, variant: "destructive" });
      setTimeout(() => setUploading(null), 4000);
    }
  }, [currentCompany, selectedSource, user]);

  const confirmImport = useCallback(async () => {
    if (!pending || !currentCompany || !user) return;
    const { fileName, sourceKey, preview, data, type, detectedSource, selectedSource: selSrc } = pending;
    const destInfo = type === "shipment" ? "shipments" : type === "master" ? "orders + shipments" : "orders";
    setPending(null);
    setUploading({ fileName, status: "importing", total: preview.totalRows, processed: 0, errors: 0 });

    const onProgress: ProgressCallback = (processed, errors) => {
      setUploading(prev => prev ? { ...prev, processed, errors } : null);
    };

    try {
      let result: { processed: number; errors: number; errorMessages?: string[] } = { processed: 0, errors: 0 };
      if (type === "woocommerce") {
        result = await importWooCommerceOrders(data as ParsedOrder[], currentCompany.id, user.id, onProgress);
      } else if (type === "shipment") {
        result = await importShipments(data as ParsedShipment[], currentCompany.id, user.id, onProgress);
      } else if (type === "master") {
        result = await importMasterRows(data as ParsedMasterRow[], currentCompany.id, user.id, onProgress);
      }

      await supabase.from("data_intake_logs").insert({
        company_id: currentCompany.id, file_name: fileName,
        file_type: fileName.endsWith(".csv") ? "csv" : "xlsx",
        source_type: sourceKey, status: result.errors > 0 ? "completed_with_errors" : "completed",
        total_rows: preview.totalRows, processed_rows: result.processed, error_rows: result.errors,
        uploaded_by: user.id, started_at: new Date().toISOString(), completed_at: new Date().toISOString(),
      });

      setUploading({ fileName, status: "done", total: preview.totalRows, processed: result.processed, errors: result.errors, errorMessages: result.errorMessages });
      setLastSummary({
        selectedSource: selSrc,
        detectedSource: detectedSource === "pirate_ship" ? "Pirate Ship" : detectedSource === "woocommerce" ? "WooCommerce" : detectedSource === "master_xlsx" ? "Master XLSX" : "Unknown",
        destinationTable: destInfo,
        rowsImported: result.processed,
        rowsSkipped: result.errors + (preview.totalRows - result.processed - result.errors),
      });

      queryClient.invalidateQueries({ queryKey: ["data_intake_logs"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard_stats"] });

      toast({
        title: "Import complete",
        description: `${result.processed} of ${preview.totalRows} rows imported to ${destInfo}${result.errors > 0 ? ` (${result.errors} errors)` : ""}.`,
      });
    } catch (err: any) {
      setUploading(prev => prev ? { ...prev, status: "error", message: err.message } : null);
      toast({ title: "Import failed", description: err.message, variant: "destructive" });

      await supabase.from("data_intake_logs").insert({
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

  const sourceInfo = SOURCE_INFO[selectedSource];

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
            onClick={() => { setSelectedSource(s); setPending(null); setLastSummary(null); }}
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

      {/* Destination info note */}
      {sourceInfo && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-muted/30 border border-border/50 text-xs text-muted-foreground">
          <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            <strong className="text-foreground">{sourceInfo.label}</strong> CSVs write to the <strong className="text-foreground font-mono">{sourceInfo.destinationTable}</strong> table and appear on the <strong className="text-foreground">{sourceInfo.destinationPage}</strong> page.
          </span>
        </div>
      )}

      {/* Source mismatch warning */}
      {pending?.mismatch && !pending.overridden && (
        <div className="border border-warning rounded-lg p-4 bg-warning/5 space-y-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-warning" />
            <h3 className="font-semibold text-foreground">Source Mismatch Detected</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            You selected <strong className="text-foreground">{pending.selectedSource}</strong> but the CSV headers match{" "}
            <strong className="text-foreground">{pending.detectedSource === "pirate_ship" ? "Pirate Ship" : "WooCommerce"}</strong>.
            This could route data to the wrong table.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                // Auto-correct to detected source
                const correctedSource = pending.detectedSource === "pirate_ship" ? "Pirate Ship" : "WooCommerce";
                setSelectedSource(correctedSource);
                setPending(prev => prev ? { ...prev, mismatch: false, selectedSource: correctedSource, sourceKey: pending.detectedSource } : null);
              }}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors"
            >
              Switch to {pending.detectedSource === "pirate_ship" ? "Pirate Ship" : "WooCommerce"}
            </button>
            <button
              onClick={() => setPending(prev => prev ? { ...prev, overridden: true } : null)}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-accent transition-colors"
            >
              Keep {pending.selectedSource} anyway
            </button>
            <button
              onClick={() => setPending(null)}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-accent transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import preview / confirmation (only if no unresolved mismatch) */}
      {pending && (!pending.mismatch || pending.overridden) && (
        <div className="border border-info rounded-lg p-5 bg-info/5 space-y-3">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-info" />
            <h3 className="font-semibold text-foreground">Import Preview — {pending.fileName}</h3>
          </div>

          {/* Destination table badge */}
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Source:</span>
            <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">{pending.selectedSource}</span>
            {pending.detectedSource !== "unknown" && (
              <>
                <span className="text-muted-foreground">Detected:</span>
                <span className="font-mono bg-muted px-2 py-0.5 rounded text-foreground">
                  {pending.detectedSource === "pirate_ship" ? "Pirate Ship" : pending.detectedSource === "woocommerce" ? "WooCommerce" : "Master XLSX"}
                </span>
              </>
            )}
            <span className="text-muted-foreground">→</span>
            <span className="font-mono bg-primary/10 text-primary px-2 py-0.5 rounded font-semibold">
              {pending.type === "shipment" ? "shipments" : pending.type === "master" ? "orders + shipments" : "orders"}
            </span>
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
              Confirm Import ({pending.preview.totalRows} rows → {pending.type === "shipment" ? "shipments" : pending.type === "master" ? "orders + shipments" : "orders"})
            </button>
            <button onClick={() => setPending(null)} className="px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm hover:bg-accent transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Import result summary */}
      {lastSummary && (
        <div className="border border-success rounded-lg p-4 bg-success/5 space-y-2">
          <h3 className="font-semibold text-foreground text-sm flex items-center gap-2">
            <Check className="w-4 h-4 text-success" />
            Import Result Summary
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <div>
              <p className="text-muted-foreground">Selected Source</p>
              <p className="font-mono font-medium text-foreground">{lastSummary.selectedSource}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Detected Source</p>
              <p className="font-mono font-medium text-foreground">{lastSummary.detectedSource}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Destination Table</p>
              <p className="font-mono font-medium text-primary">{lastSummary.destinationTable}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rows Imported</p>
              <p className="font-mono font-bold text-success">{lastSummary.rowsImported}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Rows Skipped</p>
              <p className="font-mono font-medium text-warning">{lastSummary.rowsSkipped}</p>
            </div>
          </div>
        </div>
      )}

      {/* Upload progress */}
      {uploading && (
        <div className={cn(
          "border rounded-lg p-4 space-y-3",
          uploading.status === "error" ? "border-destructive bg-destructive/5" :
          uploading.status === "done" ? "border-success bg-success/5" :
          "border-primary bg-primary/5"
        )}>
          <div className="flex items-center gap-3">
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
                {uploading.status === "importing" && `Importing row ${uploading.processed + uploading.errors} of ${uploading.total}...`}
                {uploading.status === "done" && `Done — ${uploading.processed} imported, ${uploading.errors} errors`}
                {uploading.status === "error" && (uploading.message || "Import failed")}
              </p>
              {uploading.status === "done" && uploading.errorMessages && uploading.errorMessages.length > 0 && (
                <ul className="mt-1 space-y-0.5 max-h-24 overflow-y-auto">
                  {uploading.errorMessages.slice(0, 10).map((msg, i) => (
                    <li key={i} className="text-xs text-destructive">{msg}</li>
                  ))}
                  {uploading.errorMessages.length > 10 && (
                    <li className="text-xs text-muted-foreground">…and {uploading.errorMessages.length - 10} more</li>
                  )}
                </ul>
              )}
            </div>
            {uploading.status === "importing" && uploading.total > 0 && (
              <span className="text-sm font-mono font-bold text-primary">
                {Math.round(((uploading.processed + uploading.errors) / uploading.total) * 100)}%
              </span>
            )}
          </div>
          {/* Progress bar for importing */}
          {uploading.status === "importing" && uploading.total > 0 && (
            <div className="space-y-1">
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${Math.round(((uploading.processed + uploading.errors) / uploading.total) * 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{uploading.processed} imported{uploading.errors > 0 ? `, ${uploading.errors} errors` : ''}</span>
                <span>{uploading.total - uploading.processed - uploading.errors} remaining</span>
              </div>
            </div>
          )}
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
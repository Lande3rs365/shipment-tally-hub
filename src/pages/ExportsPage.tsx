import { useState } from "react";
import { cn } from "@/lib/utils";
import { FileDown, Loader2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";

const db = supabase as any;

// ── CSV helpers ──────────────────────────────────────────────────────────────

function csvCell(val: string | number | null | undefined): string {
  const s = val == null ? "" : String(val);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toRow(fields: (string | number | null | undefined)[]): string {
  return fields.map(csvCell).join(",");
}

function downloadCsv(filename: string, rows: string[]): void {
  const content = rows.join("\r\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function datestamp(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Export functions ─────────────────────────────────────────────────────────

async function exportAllOrders(companyId: string): Promise<void> {
  const PAGE = 1000;
  let all: any[] = [];
  let page = 0;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await db
      .from("orders")
      .select("order_number, customer_name, customer_email, status, woo_status, order_date, total_amount, order_items(id)")
      .eq("company_id", companyId)
      .order("order_date", { ascending: false })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw error;
    all = all.concat(data || []);
    hasMore = (data || []).length === PAGE;
    page++;
  }

  const header = toRow(["Order #", "Customer Name", "Email", "Status", "WooCommerce Status", "Order Date", "Total ($)", "Line Items"]);
  const rows = all.map((o: any) =>
    toRow([
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.status,
      o.woo_status,
      o.order_date ? new Date(o.order_date).toLocaleDateString("en-US") : "",
      o.total_amount != null ? Number(o.total_amount).toFixed(2) : "",
      (o.order_items || []).length,
    ])
  );
  downloadCsv(`all-orders-${datestamp()}.csv`, [header, ...rows]);
  toast.success(`Exported ${all.length} orders`);
}

async function exportBacklog(companyId: string): Promise<void> {
  const BACKLOG_STATUSES = ["processing", "pending", "on_hold", "awaiting_stock"];
  const { data, error } = await db
    .from("orders")
    .select("order_number, customer_name, customer_email, status, woo_status, order_date, total_amount")
    .eq("company_id", companyId)
    .in("status", BACKLOG_STATUSES)
    .order("order_date", { ascending: true });
  if (error) throw error;

  const now = new Date();
  const header = toRow(["Order #", "Customer Name", "Email", "Status", "WooCommerce Status", "Order Date", "Days Waiting", "Total ($)"]);
  const rows = (data || []).map((o: any) => {
    const orderDate = o.order_date ? new Date(o.order_date) : null;
    const daysWaiting = orderDate ? Math.floor((now.getTime() - orderDate.getTime()) / 86_400_000) : "";
    return toRow([
      o.order_number,
      o.customer_name,
      o.customer_email,
      o.status,
      o.woo_status,
      orderDate ? orderDate.toLocaleDateString("en-US") : "",
      daysWaiting,
      o.total_amount != null ? Number(o.total_amount).toFixed(2) : "",
    ]);
  });
  downloadCsv(`backlog-report-${datestamp()}.csv`, [header, ...rows]);
  toast.success(`Exported ${(data || []).length} backlog orders`);
}

async function exportExceptions(companyId: string): Promise<void> {
  const { data, error } = await db
    .from("exceptions")
    .select("id, exception_type, status, severity, reason, notes, created_at, orders:linked_order_id(order_number, customer_name, woo_status, order_date)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const header = toRow(["Exception ID", "Type", "Status", "Severity", "Reason", "Order #", "Customer", "WooStatus", "Order Date", "Created At", "Notes"]);
  const rows = (data || []).map((e: any) => {
    const ord = e.orders || {};
    return toRow([
      e.id,
      e.exception_type,
      e.status,
      e.severity || "",
      e.reason || "",
      ord.order_number || "",
      ord.customer_name || "",
      ord.woo_status || "",
      ord.order_date ? new Date(ord.order_date).toLocaleDateString("en-US") : "",
      e.created_at ? new Date(e.created_at).toLocaleDateString("en-US") : "",
      e.notes || "",
    ]);
  });
  downloadCsv(`exception-summary-${datestamp()}.csv`, [header, ...rows]);
  toast.success(`Exported ${(data || []).length} exceptions`);
}

async function exportInventory(companyId: string): Promise<void> {
  const { data, error } = await db
    .from("inventory")
    .select("on_hand, available, reserved, allocated, damaged, products(sku, name, reorder_point), stock_locations(name, code)")
    .eq("company_id", companyId)
    .order("products(sku)", { ascending: true });
  if (error) throw error;

  const header = toRow(["SKU", "Product Name", "Location", "Location Code", "On Hand", "Available", "Reserved", "Allocated", "Damaged", "Reorder Point", "Alert"]);
  const rows = (data || []).map((inv: any) => {
    const p = inv.products || {};
    const loc = inv.stock_locations || {};
    const atRisk = inv.on_hand <= (p.reorder_point || 0) ? "YES" : "";
    return toRow([
      p.sku || "",
      p.name || "",
      loc.name || "",
      loc.code || "",
      inv.on_hand,
      inv.available,
      inv.reserved,
      inv.allocated,
      inv.damaged,
      p.reorder_point != null ? p.reorder_point : "",
      atRisk,
    ]);
  });
  downloadCsv(`inventory-snapshot-${datestamp()}.csv`, [header, ...rows]);
  toast.success(`Exported ${(data || []).length} inventory records`);
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ExportKey = "all_orders" | "backlog" | "exceptions" | "inventory";

const EXPORTS: { key: ExportKey; name: string; description: string }[] = [
  { key: "all_orders", name: "Support Update — All Orders", description: "Full order list with status, customer, and totals" },
  { key: "backlog", name: "Backlog Report", description: "Orders awaiting shipment or stock (processing / on hold)" },
  { key: "exceptions", name: "Exception Summary", description: "All exceptions with linked order details" },
  { key: "inventory", name: "Inventory Snapshot", description: "Current stock levels by SKU and location with reorder alerts" },
];

const COMING_SOON = [
  { name: "Stock Delay Notices", description: "Customer notices for stock-delayed orders" },
];

export default function ExportsPage() {
  return <ExportsContent />;
}

export function ExportsContent({ embedded = false }: { embedded?: boolean }) {
  const { currentCompany } = useCompany();
  const [loading, setLoading] = useState<ExportKey | null>(null);

  const handleExport = async (key: ExportKey) => {
    if (!currentCompany) {
      toast.error("No company selected");
      return;
    }
    setLoading(key);
    try {
      const cid = currentCompany.id;
      if (key === "all_orders") await exportAllOrders(cid);
      else if (key === "backlog") await exportBacklog(cid);
      else if (key === "exceptions") await exportExceptions(cid);
      else if (key === "inventory") await exportInventory(cid);
    } catch (err: any) {
      console.error("Export failed:", err);
      toast.error("Export failed: " + (err?.message || "Unknown error"));
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className={cn(embedded ? "space-y-6" : "p-6 space-y-6")}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold">Exports</h1>
          <p className="text-sm text-muted-foreground">Generate CSV exports for support and operations</p>
        </div>
      )}

      <div className="grid gap-3">
        {EXPORTS.map(({ key, name, description }) => {
          const isLoading = loading === key;
          return (
            <div
              key={key}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between hover:border-primary/30 transition-colors"
            >
              <div>
                <p className="font-medium text-foreground">{name}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
              </div>
              <button
                onClick={() => handleExport(key)}
                disabled={isLoading || !!loading}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <FileDown className="w-4 h-4" />
                )}
                CSV
              </button>
            </div>
          );
        })}

        {COMING_SOON.map(({ name, description }) => (
          <div
            key={name}
            className="bg-card border border-border rounded-lg p-4 flex items-center justify-between opacity-50"
          >
            <div>
              <p className="font-medium text-foreground">{name}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <button
              disabled
              className="flex items-center gap-2 px-4 py-2 bg-muted text-muted-foreground rounded-md text-sm cursor-not-allowed"
            >
              <Clock className="w-4 h-4" />
              Coming soon
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

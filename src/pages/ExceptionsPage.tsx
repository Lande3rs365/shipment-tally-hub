import { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import KpiCard from "@/components/KpiCard";
import { useExceptions } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, CheckCircle, Phone, ArrowUp, ArrowDown, ArrowUpDown, X, Clock, ShieldAlert, Search } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const TAG_OPTIONS = [
  { value: "oos_accessories", label: "OOS - Accessories", color: "bg-destructive/15 text-destructive" },
  { value: "oos_apparel", label: "OOS - Apparel", color: "bg-destructive/15 text-destructive" },
  { value: "oos_case", label: "OOS - Case", color: "bg-destructive/15 text-destructive" },
  { value: "oos_cue", label: "OOS - Cue", color: "bg-destructive/15 text-destructive" },
  { value: "oos_shaft", label: "OOS - Shaft", color: "bg-destructive/15 text-destructive" },
  { value: "int_order_apac", label: "Int Order - APAC", color: "bg-teal-500/15 text-teal-600" },
  { value: "int_order_chn", label: "Int Order - CHN", color: "bg-teal-500/15 text-teal-600" },
  { value: "int_order_us", label: "Int Order - US", color: "bg-teal-500/15 text-teal-600" },
  { value: "cust_address_incomplete", label: "Customer - Address Incomplete", color: "bg-blue-500/15 text-blue-600" },
  { value: "cust_additional_shipping", label: "Customer - Additional Shipping", color: "bg-blue-500/15 text-blue-600" },
  { value: "wh_replacements", label: "WH - Replacements / Missing Items", color: "bg-purple-500/15 text-purple-600" },
  { value: "wh_returns_warranty", label: "WH - Returns, Warranty & Exchange", color: "bg-purple-500/15 text-purple-600" },
  { value: "flagged_fraud", label: "Flagged - Fraud / Risk", color: "bg-red-500/15 text-red-600" },
  { value: "acc_refund_cancel", label: "Acc - Refund / Cancellation Req", color: "bg-orange-500/15 text-orange-600" },
  { value: "other", label: "Other", color: "bg-muted text-muted-foreground" },
];

const getTagMeta = (reason: string | null) =>
  TAG_OPTIONS.find(r => r.value === reason) || null;

// Keep old reason values working too
const LEGACY_REASON_MAP: Record<string, string> = {
  oos: "oos_cue",
  refund_req: "acc_refund_cancel",
  cancellation_req: "acc_refund_cancel",
  need_shipping_dets: "cust_address_incomplete",
  returned_item: "wh_returns_warranty",
  customs: "int_order_apac",
  apac_order: "int_order_apac",
};

const resolveTag = (reason: string | null) => {
  if (!reason) return null;
  return getTagMeta(reason) || getTagMeta(LEGACY_REASON_MAP[reason]) || null;
};

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
  const queryClient = useQueryClient();
  const [sortCol, setSortCol] = useState<SortKey | null>("order_date");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkApplying, setBulkApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [tagFilter, setTagFilter] = useState<string>("all");

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

  // Apply search + tag filter
  const filteredActive = useMemo(() => {
    let items = active;
    if (search) {
      const q = search.toLowerCase();
      items = items.filter(e =>
        (e.orders?.order_number || '').toLowerCase().includes(q) ||
        (e.orders?.customer_name || '').toLowerCase().includes(q) ||
        (e.title || '').toLowerCase().includes(q)
      );
    }
    if (tagFilter !== "all") {
      items = items.filter(e => e.reason === tagFilter || LEGACY_REASON_MAP[e.reason || ''] === tagFilter);
    }
    return items;
  }, [active, search, tagFilter]);

  const applySorting = useCallback((items: typeof active) => {
    if (!sortCol) return items;
    return [...items].sort((a, b) => {
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
  }, [sortCol, sortDir]);

  const sortedFiltered = useMemo(() => {
    const onHold = filteredActive.filter(e => e.exception_type === "on_hold");
    const other = filteredActive.filter(e => e.exception_type !== "on_hold");
    return { onHold: applySorting(onHold), other: applySorting(other) };
  }, [filteredActive, applySorting]);

  const allFilteredIds = useMemo(() => filteredActive.map(e => e.id), [filteredActive]);

  const toggleOne = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === allFilteredIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(allFilteredIds));
    }
  };

  const handleBulkReason = async (reason: string) => {
    if (selected.size === 0) return;
    setBulkApplying(true);
    try {
      const ids = Array.from(selected);
      const { error } = await supabase.from("exceptions").update({ reason }).in("id", ids);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["exceptions"] });
      const label = TAG_OPTIONS.find(r => r.value === reason)?.label || reason;
      toast({ title: `Set "${label}" on ${ids.length} exception${ids.length > 1 ? "s" : ""}` });
      setSelected(new Set());
    } catch (err: any) {
      toast({ title: "Failed to update", description: err.message, variant: "destructive" });
    }
    setBulkApplying(false);
  };

  // Tag counts for dropdown
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    active.forEach(e => {
      const r = e.reason || 'unassigned';
      const mapped = LEGACY_REASON_MAP[r] || r;
      counts[mapped] = (counts[mapped] || 0) + 1;
    });
    return counts;
  }, [active]);

  if (!currentCompany) return <EmptyState icon={AlertTriangle} title="No company selected" />;

  const renderSortableHeader = (showCheckbox: boolean, sectionIds: string[]) => (
    <TableRow className="bg-muted/50">
      {showCheckbox && (
        <TableHead className="w-[40px] px-3">
          <Checkbox
            checked={sectionIds.length > 0 && sectionIds.every(id => selected.has(id))}
            onCheckedChange={() => {
              const allSelected = sectionIds.every(id => selected.has(id));
              setSelected(prev => {
                const next = new Set(prev);
                sectionIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
                return next;
              });
            }}
          />
        </TableHead>
      )}
      <TableHead className="w-[340px]">Order</TableHead>
      <TableHead className="w-[150px] text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("order_date")}>
        <span className="inline-flex items-center justify-center">Order Date <SortIcon column="order_date" activeCol={sortCol} activeDir={sortDir} /></span>
      </TableHead>
      <TableHead className="w-[150px] text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("contacted")}>
        <span className="inline-flex items-center justify-center">Contacted <SortIcon column="contacted" activeCol={sortCol} activeDir={sortDir} /></span>
      </TableHead>
      <TableHead className="w-[200px] cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("reason")}>
        <span className="inline-flex items-center">Reason <SortIcon column="reason" activeCol={sortCol} activeDir={sortDir} /></span>
      </TableHead>
      <TableHead className="w-[140px] text-center cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort("status")}>
        <span className="inline-flex items-center justify-center">Status <SortIcon column="status" activeCol={sortCol} activeDir={sortDir} /></span>
      </TableHead>
    </TableRow>
  );

  const renderRow = (exc: typeof exceptions[0], showCheckbox: boolean) => {
    const orderNumber = exc.orders?.order_number;
    const wooStatus = exc.orders?.woo_status;
    const tagMeta = resolveTag(exc.reason);
    const orderDate = exc.orders?.order_date;
    const isOnHold = exc.exception_type === "on_hold";
    const isSelected = selected.has(exc.id);

    return (
      <TableRow key={exc.id} className={cn(isSelected && "bg-accent/50")}>
        {showCheckbox && (
          <TableCell className="px-3 py-3">
            <Checkbox checked={isSelected} onCheckedChange={() => toggleOne(exc.id)} />
          </TableCell>
        )}
        <TableCell className="py-3">
          <div className="flex items-center gap-2 min-w-0">
            {orderNumber ? (
              <Link to={`/orders/${orderNumber}`} className={cn("font-mono text-sm font-bold hover:underline shrink-0", getOrderNumberColor(wooStatus))}>
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
          {tagMeta ? (
            <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full inline-block", tagMeta.color)}>
              {tagMeta.label}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell className="text-center py-3">
          {isOnHold ? (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-600 inline-block">On Hold</span>
          ) : (
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-blue-500/15 text-blue-600 inline-block">Active</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Exception Queue</h1>
        <p className="text-sm text-muted-foreground">{exceptions.length} total · Triage & resolve operational issues</p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="On Hold" value={active.filter(e => e.exception_type === "on_hold").length} icon={Phone} variant="warning" />
        <KpiCard title="Active" value={active.filter(e => e.exception_type !== "on_hold").length} icon={ShieldAlert} variant="danger" />
        <KpiCard title="Unassigned" value={active.filter(e => !e.reason).length} icon={Clock} variant="info" />
        <KpiCard title="Resolved" value={resolved.length} icon={CheckCircle} variant="success" />
      </div>

      {/* Filter row: tabs (tag dropdown) + search + showing count */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Select value={tagFilter} onValueChange={setTagFilter}>
          <SelectTrigger className="w-full sm:w-[280px] bg-card">
            <SelectValue placeholder="All Tags" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tags ({active.length})</SelectItem>
            {TAG_OPTIONS.map(t => (
              <SelectItem key={t.value} value={t.value}>
                {t.label} ({tagCounts[t.value] || 0})
              </SelectItem>
            ))}
            <SelectItem value="unassigned">Unassigned ({active.filter(e => !e.reason).length})</SelectItem>
          </SelectContent>
        </Select>

        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search order, customer, title..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {(tagFilter !== "all" || search) && (
          <button onClick={() => { setTagFilter("all"); setSearch(""); }} className="text-xs text-muted-foreground hover:text-foreground transition-colors underline">
            Clear filters
          </button>
        )}

        <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
          Showing {filteredActive.length} of {active.length}
        </span>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-accent/30 border border-border rounded-lg px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={handleBulkReason} disabled={bulkApplying}>
            <SelectTrigger className="h-8 w-[220px] text-xs">
              <SelectValue placeholder="Assign tag…" />
            </SelectTrigger>
            <SelectContent>
              {TAG_OPTIONS.map(r => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => setSelected(new Set())}>
            <X className="w-3 h-3 mr-1" /> Clear
          </Button>
        </div>
      )}

      {isLoading ? (
        <LoadingSpinner message="Loading exceptions..." />
      ) : filteredActive.length === 0 && resolved.length === 0 ? (
        <EmptyState icon={AlertTriangle} title="No exceptions" description="Exceptions will appear here when issues are detected." />
      ) : (
        <div className="space-y-6">
          {sortedFiltered.onHold.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                <Phone className="w-3.5 h-3.5" /> On-Hold Orders — Follow Up Required ({sortedFiltered.onHold.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>{renderSortableHeader(true, sortedFiltered.onHold.map(e => e.id))}</TableHeader>
                    <TableBody>{sortedFiltered.onHold.map(exc => renderRow(exc, true))}</TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {sortedFiltered.other.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Other Exceptions ({sortedFiltered.other.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>{renderSortableHeader(true, sortedFiltered.other.map(e => e.id))}</TableHeader>
                    <TableBody>{sortedFiltered.other.map(exc => renderRow(exc, true))}</TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          {resolved.length > 0 && (
            <div>
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                Resolved ({resolved.length})
              </h3>
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>{renderSortableHeader(false, [])}</TableHeader>
                    <TableBody>
                      {resolved.map(exc => {
                        const orderNumber = exc.orders?.order_number;
                        const wooStatus = exc.orders?.woo_status;
                        const tagMeta = resolveTag(exc.reason);
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
                              {tagMeta ? (
                                <span className={cn("text-xs font-medium px-2.5 py-1 rounded-full inline-block", tagMeta.color)}>
                                  {tagMeta.label}
                                </span>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                            <TableCell className="text-center">
                              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-green-500/15 text-green-600 inline-block">Resolved</span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

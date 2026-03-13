import { useState, useRef, useEffect, useMemo } from "react";
import { useReturns, useOrders, useProducts, useStockLocations } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent } from "@/components/ui/card";
import KpiCard from "@/components/KpiCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  RotateCcw, Search as SearchIcon, ArrowRight, CheckCircle2,
  ArrowLeftRight, ShieldCheck, PackageX, PackageSearch, AlertTriangle, HelpCircle, Plus,
  Truck, Globe,
} from "lucide-react";

import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// ── Map return DB status to standard ticket statuses ──
// new → on-hold / processing / refunded (when authorised)
const mapReturnStatus = (status: string | null, stockOutcome: string | null): string => {
  switch (status) {
    case 'initiated': return 'new';
    case 'approved':
      if (stockOutcome === 'refund') return 'refunded';
      if (stockOutcome === 'warranty_review' || stockOutcome === 'quarantine') return 'on-hold';
      return 'processing';
    case 'received':
      if (stockOutcome === 'refund') return 'refunded';
      if (stockOutcome === 'warranty_review' || stockOutcome === 'quarantine') return 'on-hold';
      return 'processing';
    case 'resolved':
      if (stockOutcome === 'refund') return 'refunded';
      return 'completed';
    case 'rejected': return 'cancelled';
    default: return status?.replace(/_/g, '-') || 'pending';
  }
};

// ── Return reason categories ──
type ReturnReason = 'exchanged' | 'warranty_replacement' | 'damaged_on_arrival' | 'missing_item' | 'incorrect_item' | 'shipping' | 'customs' | 'other';

const reasonConfig: Record<ReturnReason, {
  label: string;
  icon: JSX.Element;
  description: string;
  outcome: string;
  colorClass: string;
}> = {
  exchanged: {
    label: 'Exchanged',
    icon: <ArrowLeftRight className="w-5 h-5" />,
    description: 'Item swapped for another size/model',
    outcome: 'Replacement shipped',
    colorClass: 'border-l-[hsl(var(--primary))]',
  },
  warranty_replacement: {
    label: 'Warranty Replacement',
    icon: <ShieldCheck className="w-5 h-5" />,
    description: 'Fault covered under warranty',
    outcome: 'Replacement shipped',
    colorClass: 'border-l-[hsl(var(--info))]',
  },
  damaged_on_arrival: {
    label: 'Damaged on Arrival',
    icon: <PackageX className="w-5 h-5" />,
    description: 'Item arrived broken',
    outcome: 'Replace or refund',
    colorClass: 'border-l-[hsl(var(--destructive))]',
  },
  missing_item: {
    label: 'Missing Item',
    icon: <PackageSearch className="w-5 h-5" />,
    description: 'Part of order missing',
    outcome: 'Ship missing item',
    colorClass: 'border-l-[hsl(var(--warning))]',
  },
  incorrect_item: {
    label: 'Incorrect Item Sent',
    icon: <AlertTriangle className="w-5 h-5" />,
    description: 'Warehouse shipped wrong product',
    outcome: 'Send correct item',
    colorClass: 'border-l-[hsl(var(--warning))]',
  },
  shipping: {
    label: 'Shipping',
    icon: <Truck className="w-5 h-5" />,
    description: 'Lost or damaged in transit',
    outcome: 'Carrier claim / reship',
    colorClass: 'border-l-[hsl(var(--info))]',
  },
  customs: {
    label: 'Customs',
    icon: <Globe className="w-5 h-5" />,
    description: 'Held or returned by customs',
    outcome: 'Reship or refund',
    colorClass: 'border-l-[hsl(var(--warning))]',
  },
  other: {
    label: 'Other',
    icon: <HelpCircle className="w-5 h-5" />,
    description: 'Reason not listed above',
    outcome: 'Assess individually',
    colorClass: 'border-l-muted-foreground',
  },
};

// ── Stock outcomes mapped from reason ──
const reasonToStockOutcome: Record<ReturnReason, string> = {
  exchanged: 'restock',
  warranty_replacement: 'warranty_review',
  damaged_on_arrival: 'quarantine',
  missing_item: 'restock',
  incorrect_item: 'restock',
  shipping: 'quarantine',
  customs: 'quarantine',
  other: 'quarantine',
};

// ── Order status mapped from reason ──
const reasonToOrderStatus: Record<ReturnReason, string> = {
  exchanged: 'processing',
  missing_item: 'processing',
  incorrect_item: 'processing',
  warranty_replacement: 'on-hold',
  damaged_on_arrival: 'on-hold',
  shipping: 'on-hold',
  customs: 'on-hold',
  other: 'on-hold',
};

// ── Exception reason mapped from return reason ──
const reasonToExceptionReason: Record<string, string> = {
  warranty_replacement: 'Returned Item',
  damaged_on_arrival: 'Returned Item',
  shipping: 'Returned Item',
  customs: 'Customs',
  other: 'Returned Item',
};

export default function ReturnsPage() {
  const [showNewReturn, setShowNewReturn] = useState(false);
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [notes, setNotes] = useState('');
  const [duplicateWarning, setDuplicateWarning] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: returns = [], isLoading } = useReturns();
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();
  const { data: locations = [] } = useStockLocations();

  const matchedOrder = orders.find(o => o.order_number.toLowerCase() === orderNumber.trim().toLowerCase());
  const matchedItem = matchedOrder?.order_items?.find((i: any) => i.id === selectedItemId);
  const matchedProduct = matchedItem?.product_id ? products.find(p => p.id === matchedItem.product_id) : null;

  // Auto-select if order has only one item
  useEffect(() => {
    if (matchedOrder?.order_items?.length === 1 && !selectedItemId) {
      setSelectedItemId(matchedOrder.order_items[0].id);
    }
  }, [matchedOrder, selectedItemId]);

  // Duplicate check when item is selected
  useEffect(() => {
    const checkDuplicate = async () => {
      if (!matchedOrder || !selectedItemId || !currentCompany) {
        setDuplicateWarning('');
        return;
      }
      const item = matchedOrder.order_items?.find((i: any) => i.id === selectedItemId);
      if (!item) return;

      const { data } = await supabase
        .from('returns')
        .select('id, return_number')
        .eq('company_id', currentCompany.id)
        .eq('order_id', matchedOrder.id)
        .eq('sku', item.sku || '')
        .limit(1);

      if (data && data.length > 0) {
        setDuplicateWarning(`A return already exists for this item (${data[0].return_number}). Submitting will create an additional return.`);
      } else {
        setDuplicateWarning('');
      }
    };
    checkDuplicate().catch(() => setDuplicateWarning(''));
  }, [selectedItemId, matchedOrder, currentCompany]);

  const canProceed = matchedOrder && selectedItemId && reason && quantity > 0;

  const handleReset = () => {
    setStep('form');
    setOrderNumber('');
    setSelectedItemId('');
    setQuantity(1);
    setReason(null);
    setNotes('');
    setDuplicateWarning('');
  };

  const handleOpenNew = () => {
    handleReset();
    setShowNewReturn(true);
  };

  const handleConfirm = async () => {
    if (!reason || !matchedOrder || !matchedItem || !currentCompany) return;
    const stockOutcome = reasonToStockOutcome[reason];
    const newOrderStatus = reasonToOrderStatus[reason];
    const primaryLocation = locations[0];

    try {
      // 1. Insert return record
      const { data: returnRecord, error: retErr } = await supabase.from('returns').insert({
        company_id: currentCompany.id,
        order_id: matchedOrder.id,
        return_number: `RET-${Date.now()}`,
        status: 'received',
        reason: reasonConfig[reason].label,
        condition: reason === 'damaged_on_arrival' ? 'damaged' : reason === 'warranty_replacement' ? 'defective' : 'resellable',
        resolution: 'approved',
        stock_outcome: stockOutcome,
        return_qty: quantity,
        product_id: matchedItem.product_id || null,
        sku: matchedItem.sku || null,
        notes: notes || null,
        initiated_date: new Date().toISOString(),
        received_date: new Date().toISOString(),
      }).select('id').single();

      if (retErr) throw retErr;

      // 2. Stock movement + inventory update
      if (matchedItem.product_id && stockOutcome !== 'return_to_client') {
        const direction = stockOutcome === 'write_off' ? 'OUT' : 'IN';
        const movementType = stockOutcome === 'restock' ? 'return_restock'
          : stockOutcome === 'quarantine' ? 'return_quarantine'
          : 'return_warranty';

        await supabase.from('stock_movements').insert({
          company_id: currentCompany.id,
          product_id: matchedItem.product_id,
          sku: matchedItem.sku || null,
          direction,
          movement_type: movementType,
          quantity,
          to_location_id: primaryLocation?.id || null,
          linked_order_id: matchedOrder.id,
          linked_return_id: returnRecord?.id || null,
          reason_code: `Return — ${reasonConfig[reason].label}`,
          notes: `Outcome: ${stockOutcome}`,
          performed_by: user?.id || null,
        });

        if (primaryLocation) {
          const { data: existing } = await supabase
            .from('inventory')
            .select('id, on_hand, available, damaged')
            .eq('product_id', matchedItem.product_id)
            .eq('location_id', primaryLocation.id)
            .maybeSingle();

          if (existing) {
            const updates: Record<string, number> = {};
            if (stockOutcome === 'restock') {
              updates.on_hand = existing.on_hand + quantity;
              updates.available = existing.available + quantity;
            } else if (stockOutcome === 'quarantine' || stockOutcome === 'warranty_review') {
              updates.on_hand = existing.on_hand + quantity;
              updates.damaged = existing.damaged + quantity;
            }
            if (Object.keys(updates).length > 0) {
              await supabase.from('inventory').update(updates).eq('id', existing.id);
            }
          }
        }
      }

      // 3. Update order status
      await supabase
        .from('orders')
        .update({ status: newOrderStatus, woo_status: newOrderStatus })
        .eq('id', matchedOrder.id);

      // 4. Insert order event audit log
      await supabase.from('order_events').insert({
        order_id: matchedOrder.id,
        event_type: 'return_processed',
        description: `Return processed: ${reasonConfig[reason].label} — Qty ${quantity} — Stock: ${stockOutcome} — Order → ${newOrderStatus}`,
        created_by: user?.id || null,
        metadata: {
          return_id: returnRecord?.id,
          reason: reason,
          stock_outcome: stockOutcome,
          new_order_status: newOrderStatus,
          quantity,
        },
      });

      // 5. Auto-create exception for on_hold returns
      if (newOrderStatus === 'on-hold') {
        const exceptionReason = reasonToExceptionReason[reason] || 'Returned Item';
        await supabase.from('exceptions').insert({
          company_id: currentCompany.id,
          title: `Return: ${reasonConfig[reason].label} — ${matchedOrder.order_number}`,
          exception_type: 'returned_item',
          severity: reason === 'damaged_on_arrival' ? 'high' : 'medium',
          status: 'open',
          reason: exceptionReason,
          description: `Return ${returnRecord?.id ? `RET-${returnRecord.id.slice(0, 8)}` : ''} requires approval. ${notes || ''}`.trim(),
          linked_order_id: matchedOrder.id,
          linked_return_id: returnRecord?.id || null,
          created_by: user?.id || null,
        });
      }

      // 6. Invalidate all related caches
      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['exceptions'] });

      setStep('done');
      toast.success('Return processed successfully');
    } catch (err) {
      toast.error('Failed to process return');
    }
  };

  const returnCounts = useMemo(() => ({
    initiated: returns.filter(r => r.status === 'initiated').length,
    received: returns.filter(r => r.status === 'received' || r.status === 'approved').length,
    resolved: returns.filter(r => r.status === 'resolved').length,
    refunded: returns.filter(r => r.stock_outcome === 'refund' || r.resolution === 'refund').length,
  }), [returns]);

  const statusTabs = useMemo(() => [
    { key: 'all', label: `All (${returns.length})` },
    { key: 'initiated', label: `Awaiting (${returnCounts.initiated})` },
    { key: 'in_progress', label: `In Progress (${returnCounts.received})` },
    { key: 'resolved', label: `Resolved (${returnCounts.resolved})` },
  ], [returns.length, returnCounts]);

  const filteredReturns = useMemo(() => {
    let result = returns;
    if (statusFilter !== 'all') {
      if (statusFilter === 'initiated') result = result.filter(r => r.status === 'initiated');
      else if (statusFilter === 'in_progress') result = result.filter(r => r.status === 'received' || r.status === 'approved');
      else if (statusFilter === 'resolved') result = result.filter(r => r.status === 'resolved');
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.orders?.order_number || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [returns, statusFilter, search]);

  if (!currentCompany) return <EmptyState icon={RotateCcw} title="No company selected" />;

  const returnCounts = useMemo(() => ({
    initiated: returns.filter(r => r.status === 'initiated').length,
    received: returns.filter(r => r.status === 'received' || r.status === 'approved').length,
    resolved: returns.filter(r => r.status === 'resolved').length,
    refunded: returns.filter(r => r.stock_outcome === 'refund' || r.resolution === 'refund').length,
  }), [returns]);

  const statusTabs = [
    { key: 'all', label: `All (${returns.length})` },
    { key: 'initiated', label: `Awaiting (${returnCounts.initiated})` },
    { key: 'in_progress', label: `In Progress (${returnCounts.received})` },
    { key: 'resolved', label: `Resolved (${returnCounts.resolved})` },
  ];

  const filteredReturns = useMemo(() => {
    let result = returns;
    if (statusFilter !== 'all') {
      if (statusFilter === 'initiated') result = result.filter(r => r.status === 'initiated');
      else if (statusFilter === 'in_progress') result = result.filter(r => r.status === 'received' || r.status === 'approved');
      else if (statusFilter === 'resolved') result = result.filter(r => r.status === 'resolved');
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(r =>
        (r.orders?.order_number || '').toLowerCase().includes(q) ||
        (r.orders?.customer_name || '').toLowerCase().includes(q) ||
        (r.reason || '').toLowerCase().includes(q) ||
        (r.sku || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [returns, statusFilter, search]);

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Returns</h1>
          <p className="text-sm text-muted-foreground">{returns.length} returns · Manage returns, exchanges, and warranty claims</p>
        </div>
        <Button onClick={handleOpenNew} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Return
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Awaiting Action" value={returnCounts.initiated} icon={AlertTriangle} variant="warning" />
        <KpiCard title="In Progress" value={returnCounts.received} icon={ArrowLeftRight} variant="info" />
        <KpiCard title="Resolved" value={returnCounts.resolved} icon={CheckCircle2} variant="success" />
        <KpiCard title="Refunded" value={returnCounts.refunded} icon={RotateCcw} variant="danger" />
      </div>

      {/* Filter row: tabs + search on same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {statusTabs.map(f => (
            <button
              key={f.key}
              onClick={() => setStatusFilter(f.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                statusFilter === f.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search order, customer, reason, SKU..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
          Showing {filteredReturns.length} of {returns.length}
        </span>
      </div>

      <ReturnsTable returns={filteredReturns} isLoading={isLoading} />

      <Dialog open={showNewReturn} onOpenChange={setShowNewReturn}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-primary" />
              {step === 'form' ? 'Log Return' : step === 'confirm' ? 'Confirm Return' : 'Return Processed'}
            </DialogTitle>
          </DialogHeader>

          {step === 'form' && (
            <ReturnForm
              orderNumber={orderNumber}
              setOrderNumber={setOrderNumber}
              matchedOrder={matchedOrder}
              selectedItemId={selectedItemId}
              setSelectedItemId={setSelectedItemId}
              quantity={quantity}
              setQuantity={setQuantity}
              matchedItem={matchedItem}
              matchedProduct={matchedProduct}
              reason={reason}
              setReason={setReason}
              notes={notes}
              setNotes={setNotes}
              canProceed={!!canProceed}
              duplicateWarning={duplicateWarning}
              products={products}
              onSubmit={() => { if (canProceed) setStep('confirm'); }}
              autoFocus={showNewReturn}
            />
          )}
          {step === 'confirm' && reason && matchedOrder && matchedItem && (
            <ConfirmStep
              matchedOrder={matchedOrder}
              matchedItem={matchedItem}
              matchedProduct={matchedProduct}
              quantity={quantity}
              reason={reason}
              stockOutcome={reasonToStockOutcome[reason]}
              orderStatus={reasonToOrderStatus[reason]}
              onBack={() => setStep('form')}
              onConfirm={handleConfirm}
            />
          )}
          {step === 'done' && (
            <DoneStep onReset={handleReset} onClose={() => setShowNewReturn(false)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Returns Table ──
const ReturnsTable = ({ returns, isLoading }: { returns: any[]; isLoading: boolean }) => {
  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (returns.length === 0) return <EmptyState icon={RotateCcw} title="No returns yet" description="Process your first return using the New Return button" />;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Order</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Name</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Returned Date</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Reason</th>
                <th className="text-center py-2.5 px-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-primary">{r.orders?.order_number || '—'}</td>
                  <td className="py-2 px-3 text-sm text-foreground">{r.orders?.customer_name || '—'}</td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    {r.received_date ? format(new Date(r.received_date), 'dd MMM yyyy') : '—'}
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-xs font-normal">{r.reason || '—'}</Badge>
                  </td>
                  <td className="py-2 px-3 text-center text-sm font-medium text-foreground">
                    {r.return_qty ?? '—'}
                  </td>
                  <td className="py-2 px-3">
                    <StatusBadge status={mapReturnStatus(r.status, r.stock_outcome)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

// ── Return Form ──
const ReturnForm = ({
  orderNumber, setOrderNumber, matchedOrder, selectedItemId, setSelectedItemId,
  quantity, setQuantity, matchedItem, matchedProduct, reason, setReason, notes, setNotes,
  canProceed, duplicateWarning, products, onSubmit, autoFocus,
}: any) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (autoFocus) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const getProductName = (item: any) => {
    if (!item?.product_id) return null;
    const product = products?.find((p: any) => p.id === item.product_id);
    return product?.name || null;
  };

  return (
    <div className="space-y-5">
      {/* Order Number */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Number</label>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            ref={inputRef}
            type="text" placeholder="e.g. WC-10421"
            value={orderNumber}
            onChange={e => { setOrderNumber(e.target.value); setSelectedItemId(''); }}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
        {orderNumber && !matchedOrder && (
          <p className="text-xs text-destructive">No order found for "{orderNumber}"</p>
        )}
        {matchedOrder && (
          <p className="text-xs text-success">
            Found: {matchedOrder.customer_name} · {matchedOrder.order_items?.length || 0} item(s)
          </p>
        )}
      </div>

      {/* Select Item */}
      {matchedOrder?.order_items && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Item</label>
          <div className="space-y-2">
            {matchedOrder.order_items.map((item: any) => {
              const productName = getProductName(item);
              return (
                <button
                  key={item.id}
                  onClick={() => { setSelectedItemId(item.id); setQuantity(1); }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3 rounded-md border text-sm transition-colors",
                    selectedItemId === item.id
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-muted-foreground"
                  )}
                >
                  <div className="text-left">
                    <span className="font-mono text-xs">{item.sku || '—'}</span>
                    {productName && <span className="ml-2 text-xs text-muted-foreground">{productName}</span>}
                  </div>
                  <span>Qty ordered: {item.quantity}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Product info inline */}
      {matchedProduct && (
        <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2">
          {matchedProduct.name} · {matchedProduct.sku} {matchedProduct.unit_cost != null && `· $${matchedProduct.unit_cost}`}
        </div>
      )}

      {/* Duplicate warning */}
      {duplicateWarning && (
        <div className="flex items-start gap-2 bg-warning/10 border border-warning/30 rounded-md px-3 py-2 text-xs text-warning">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{duplicateWarning}</span>
        </div>
      )}

      {/* Return Quantity */}
      {selectedItemId && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return Quantity</label>
          <input
            type="number" min={1} max={matchedItem?.quantity || 1}
            value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)}
            className="w-24 bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      )}

      {/* Return Reason */}
      {selectedItemId && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Reason</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.entries(reasonConfig) as [ReturnReason, typeof reasonConfig[ReturnReason]][]).map(
              ([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setReason(key)}
                  className={cn(
                    "flex items-start gap-3 p-3 rounded-lg border-l-4 border text-left transition-all",
                    cfg.colorClass,
                    reason === key
                      ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                      : "border-border bg-card hover:border-muted-foreground"
                  )}
                >
                  <div className={cn("mt-0.5", reason === key ? "text-primary" : "text-muted-foreground")}>
                    {cfg.icon}
                  </div>
                  <div className="space-y-0.5">
                    <div className="text-sm font-medium text-foreground">{cfg.label}</div>
                    <div className="text-xs text-muted-foreground">{cfg.description}</div>
                  </div>
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* Notes */}
      {reason && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
          <textarea
            value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Describe the item condition, packaging state, etc."
            rows={3}
            className="w-full bg-card border border-border rounded-md px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />
        </div>
      )}

      <Button onClick={onSubmit} disabled={!canProceed} className="w-full sm:w-auto">
        Review Return <ArrowRight className="w-4 h-4" />
      </Button>
    </div>
  );
};

// ── Confirm Step ──
const ConfirmStep = ({ matchedOrder, matchedItem, matchedProduct, quantity, reason, stockOutcome, orderStatus, onBack, onConfirm }: any) => {
  const cfg = reasonConfig[reason as ReturnReason];
  const isOnHold = orderStatus === 'on-hold';

  return (
    <div className="space-y-5">
      <div className="bg-muted/30 border border-border rounded-lg p-5 space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Return Summary</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-muted-foreground">Order</span>
            <p className="font-mono text-primary">{matchedOrder.order_number}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Customer</span>
            <p className="text-foreground">{matchedOrder.customer_name}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Item</span>
            <p className="font-mono text-foreground">
              {matchedItem.sku || '—'}
              {matchedProduct && <span className="ml-1 text-xs text-muted-foreground font-sans">({matchedProduct.name})</span>}
            </p>
          </div>
          <div>
            <span className="text-muted-foreground">Quantity</span>
            <p className="text-foreground">{quantity} of {matchedItem.quantity}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Reason</span>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-muted-foreground">{cfg.icon}</span>
              <span className="text-foreground text-sm font-medium">{cfg.label}</span>
            </div>
          </div>
          <div>
            <span className="text-muted-foreground">Stock Action</span>
            <p className="text-foreground capitalize">{stockOutcome.replace(/_/g, ' ')}</p>
          </div>
          <div className="col-span-2">
            <span className="text-muted-foreground">Order Status →</span>
            <div className="mt-0.5">
              <Badge variant={isOnHold ? 'destructive' : 'default'} className="text-xs">
                {orderStatus.replace(/-/g, ' ')}
              </Badge>
              {isOnHold && (
                <span className="ml-2 text-xs text-muted-foreground">Exception will be created for approval</span>
              )}
            </div>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onConfirm}>
          <CheckCircle2 className="w-4 h-4" /> Confirm & Process
        </Button>
      </div>
    </div>
  );
};

// ── Done Step ──
const DoneStep = ({ onReset, onClose }: { onReset: () => void; onClose: () => void }) => (
  <div className="text-center py-8 space-y-4">
    <div className="w-14 h-14 rounded-full bg-[hsl(var(--success)/0.15)] flex items-center justify-center mx-auto">
      <CheckCircle2 className="w-7 h-7 text-success" />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-foreground">Return Processed</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Return recorded, stock movement created, and order status updated.
      </p>
    </div>
    <div className="flex gap-3 justify-center">
      <Button onClick={onReset} variant="outline">
        <RotateCcw className="w-4 h-4" /> Another Return
      </Button>
      <Button onClick={onClose}>Done</Button>
    </div>
  </div>
);

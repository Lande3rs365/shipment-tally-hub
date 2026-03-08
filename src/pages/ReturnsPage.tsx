import { useState } from "react";
import { useReturns, useOrders, useProducts, useStockLocations } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  RotateCcw, Search as SearchIcon, ArrowRight, CheckCircle2, XCircle,
  ArrowLeftRight, ShieldCheck, PackageX, PackageSearch, AlertTriangle, HelpCircle, Plus,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

// ── Return reason categories ──
type ReturnReason = 'exchanged' | 'warranty_replacement' | 'damaged_on_arrival' | 'missing_item' | 'incorrect_item' | 'other';

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
  other: 'quarantine',
};

export default function ReturnsPage() {
  const [tab, setTab] = useState<'list' | 'new'>('list');
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<ReturnReason | null>(null);
  const [notes, setNotes] = useState('');

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

  const canProceed = matchedOrder && selectedItemId && reason && quantity > 0;

  const handleSubmit = () => { if (canProceed) setStep('confirm'); };

  const handleConfirm = async () => {
    if (!reason || !matchedOrder || !matchedItem || !currentCompany) return;
    const stockOutcome = reasonToStockOutcome[reason];
    const primaryLocation = locations[0];

    try {
      const { data: returnRecord, error: retErr } = await (supabase as any).from('returns').insert({
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

      // Stock movement
      if (matchedItem.product_id && stockOutcome !== 'return_to_customer') {
        const direction = stockOutcome === 'write_off' ? 'OUT' : 'IN';
        const movementType = stockOutcome === 'restock' ? 'return_restock'
          : stockOutcome === 'quarantine' ? 'return_quarantine'
          : 'return_warranty';

        await (supabase as any).from('stock_movements').insert({
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

        // Update inventory
        if (primaryLocation) {
          const { data: existing } = await (supabase as any)
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
              await (supabase as any).from('inventory').update(updates).eq('id', existing.id);
            }
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['returns'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setStep('done');
      toast.success('Return processed successfully');
    } catch (err) {
      console.error('Failed to process return:', err);
      toast.error('Failed to process return');
    }
  };

  const handleReset = () => {
    setStep('form');
    setOrderNumber('');
    setSelectedItemId('');
    setQuantity(1);
    setReason(null);
    setNotes('');
  };

  if (!currentCompany) return <EmptyState icon={RotateCcw} title="No company selected" />;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Returns</h1>
          <p className="text-sm text-muted-foreground">Manage returns, exchanges, and warranty claims</p>
        </div>
        <Button onClick={() => { setTab('new'); handleReset(); }} size="sm">
          <Plus className="w-4 h-4 mr-1" /> New Return
        </Button>
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as 'list' | 'new')}>
        <TabsList>
          <TabsTrigger value="list">All Returns</TabsTrigger>
          <TabsTrigger value="new">Log Return</TabsTrigger>
        </TabsList>

        {/* ── Returns List ── */}
        <TabsContent value="list">
          <ReturnsList returns={returns} isLoading={isLoading} />
        </TabsContent>

        {/* ── New Return Form ── */}
        <TabsContent value="new">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="pb-4">
                  <CardTitle className="text-base flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-primary" />
                    {step === 'form' ? 'Log Return' : step === 'confirm' ? 'Confirm Return' : 'Return Processed'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
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
                      reason={reason}
                      setReason={setReason}
                      notes={notes}
                      setNotes={setNotes}
                      canProceed={!!canProceed}
                      onSubmit={handleSubmit}
                    />
                  )}
                  {step === 'confirm' && reason && matchedOrder && matchedItem && (
                    <ConfirmStep
                      matchedOrder={matchedOrder}
                      matchedItem={matchedItem}
                      quantity={quantity}
                      reason={reason}
                      stockOutcome={reasonToStockOutcome[reason]}
                      onBack={() => setStep('form')}
                      onConfirm={handleConfirm}
                    />
                  )}
                  {step === 'done' && (
                    <DoneStep onReset={handleReset} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar: product info */}
            <div className="space-y-4">
              {matchedProduct && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Product Info</CardTitle>
                    <p className="font-mono text-xs text-muted-foreground">{matchedProduct.sku}</p>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Name</span>
                      <span className="text-foreground">{matchedProduct.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Unit Cost</span>
                      <span className="font-mono text-foreground">{matchedProduct.unit_cost != null ? `$${matchedProduct.unit_cost}` : '—'}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Reason legend card */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Return Categories</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {(Object.entries(reasonConfig) as [ReturnReason, typeof reasonConfig[ReturnReason]][]).map(([key, cfg]) => (
                    <div key={key} className="flex items-start gap-2 text-xs">
                      <div className="text-muted-foreground mt-0.5">{cfg.icon}</div>
                      <div>
                        <p className="font-medium text-foreground">{cfg.label}</p>
                        <p className="text-muted-foreground">{cfg.outcome}</p>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Returns List Component ──
const ReturnsList = ({ returns, isLoading }: { returns: any[]; isLoading: boolean }) => {
  if (isLoading) return <div className="py-12 text-center text-muted-foreground">Loading…</div>;
  if (returns.length === 0) return <EmptyState icon={RotateCcw} title="No returns yet" description="Process your first return using the Log Return tab" />;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Return #</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Order</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Reason</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">SKU</th>
                <th className="text-right py-2.5 px-3 font-medium text-muted-foreground">Qty</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Outcome</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left py-2.5 px-3 font-medium text-muted-foreground">Date</th>
              </tr>
            </thead>
            <tbody>
              {returns.map((r: any) => (
                <tr key={r.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="py-2 px-3 font-mono text-xs text-primary">{r.return_number || '—'}</td>
                  <td className="py-2 px-3 font-mono text-xs">{r.orders?.order_number || '—'}</td>
                  <td className="py-2 px-3">
                    <Badge variant="outline" className="text-xs font-normal">{r.reason || '—'}</Badge>
                  </td>
                  <td className="py-2 px-3 font-mono text-xs text-muted-foreground">{r.sku || '—'}</td>
                  <td className="py-2 px-3 text-right font-mono text-xs">{r.return_qty ?? '—'}</td>
                  <td className="py-2 px-3 text-xs capitalize text-muted-foreground">{r.stock_outcome?.replace(/_/g, ' ') || '—'}</td>
                  <td className="py-2 px-3"><StatusBadge status={r.status} /></td>
                  <td className="py-2 px-3 text-xs text-muted-foreground">
                    {r.received_date ? format(new Date(r.received_date), 'dd MMM yyyy') : '—'}
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

// ── Return Form Component ──
const ReturnForm = ({
  orderNumber, setOrderNumber, matchedOrder, selectedItemId, setSelectedItemId,
  quantity, setQuantity, matchedItem, reason, setReason, notes, setNotes,
  canProceed, onSubmit,
}: any) => (
  <div className="space-y-5">
    {/* Order Number */}
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Number</label>
      <div className="relative">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
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
          {matchedOrder.order_items.map((item: any) => (
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
              <span className="font-mono text-xs">{item.sku || '—'}</span>
              <span>Qty ordered: {item.quantity}</span>
            </button>
          ))}
        </div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.entries(reasonConfig) as [ReturnReason, typeof reasonConfig[ReturnReason]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                onClick={() => setReason(key)}
                className={cn(
                  "flex items-start gap-3 p-4 rounded-lg border-l-4 border text-left transition-all",
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
                  <div className="text-[10px] text-muted-foreground/70 italic">{cfg.outcome}</div>
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

// ── Confirm Step ──
const ConfirmStep = ({ matchedOrder, matchedItem, quantity, reason, stockOutcome, onBack, onConfirm }: any) => {
  const cfg = reasonConfig[reason as ReturnReason];
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
            <span className="text-muted-foreground">SKU</span>
            <p className="font-mono text-foreground">{matchedItem.sku || '—'}</p>
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
            <span className="text-muted-foreground">Stock Outcome</span>
            <p className="text-foreground capitalize">{stockOutcome.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack}>Back</Button>
        <Button onClick={onConfirm}>
          <CheckCircle2 className="w-4 h-4" /> Confirm & Process Return
        </Button>
      </div>
    </div>
  );
};

// ── Done Step ──
const DoneStep = ({ onReset }: { onReset: () => void }) => (
  <div className="text-center py-8 space-y-4">
    <div className="w-14 h-14 rounded-full bg-[hsl(var(--success)/0.15)] flex items-center justify-center mx-auto">
      <CheckCircle2 className="w-7 h-7 text-success" />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-foreground">Return Processed</h3>
      <p className="text-sm text-muted-foreground mt-1">
        Return recorded and stock movement created. Inventory has been updated.
      </p>
    </div>
    <Button onClick={onReset} variant="outline">
      <RotateCcw className="w-4 h-4" /> Process Another Return
    </Button>
  </div>
);

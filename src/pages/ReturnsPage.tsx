import { useState } from "react";
import { useOrders, useProducts, useInventory } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RotateCcw, PackageCheck, ShieldAlert, Search as SearchIcon,
  AlertTriangle, ClipboardCheck, CheckCircle2, ArrowRight
} from "lucide-react";

type ReturnCondition = 'resellable' | 'damaged' | 'defective' | 'inspection-required';

const conditionConfig: Record<ReturnCondition, {
  label: string;
  icon: JSX.Element;
  statusClass: string;
  description: string;
  stockOutcome: string;
}> = {
  resellable: {
    label: 'Resellable',
    icon: <PackageCheck className="w-5 h-5" />,
    statusClass: 'status-in-stock',
    description: 'Item in original condition — restock to available inventory',
    stockOutcome: 'restock',
  },
  damaged: {
    label: 'Damaged',
    icon: <AlertTriangle className="w-5 h-5" />,
    statusClass: 'status-out-of-stock',
    description: 'Physical damage — route to quarantine for warehouse review',
    stockOutcome: 'quarantine',
  },
  defective: {
    label: 'Defective',
    icon: <ShieldAlert className="w-5 h-5" />,
    statusClass: 'status-exception',
    description: 'Product defect — route to warranty / QA inspection',
    stockOutcome: 'warranty_review',
  },
  'inspection-required': {
    label: 'Inspection Required',
    icon: <ClipboardCheck className="w-5 h-5" />,
    statusClass: 'status-low-stock',
    description: 'Condition unclear — hold for manual assessment',
    stockOutcome: 'quarantine',
  },
};

export default function ReturnsPage() {
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [orderNumber, setOrderNumber] = useState('');
  const [selectedItemId, setSelectedItemId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<ReturnCondition | null>(null);
  const [notes, setNotes] = useState('');

  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: orders = [] } = useOrders();
  const { data: products = [] } = useProducts();

  const matchedOrder = orders.find(o => o.order_number.toLowerCase() === orderNumber.trim().toLowerCase());
  const matchedItem = matchedOrder?.order_items?.find(i => i.id === selectedItemId);
  const matchedProduct = matchedItem?.product_id ? products.find(p => p.id === matchedItem.product_id) : null;

  const canProceed = matchedOrder && selectedItemId && condition && quantity > 0;

  function handleSubmit() {
    if (!canProceed) return;
    setStep('confirm');
  }

  async function handleConfirm() {
    if (!condition || !matchedOrder || !matchedItem || !currentCompany) return;
    const cfg = conditionConfig[condition];

    await (supabase as any).from('returns').insert({
      company_id: currentCompany.id,
      order_id: matchedOrder.id,
      return_number: `RET-${Date.now()}`,
      status: 'received',
      reason: notes || null,
      condition: condition,
      stock_outcome: cfg.stockOutcome,
      notes: notes || null,
      initiated_date: new Date().toISOString(),
      received_date: new Date().toISOString(),
    });

    queryClient.invalidateQueries({ queryKey: ['returns'] });
    setStep('done');
  }

  function handleReset() {
    setStep('form');
    setOrderNumber('');
    setSelectedItemId('');
    setQuantity(1);
    setCondition(null);
    setNotes('');
  }

  if (!currentCompany) return <EmptyState icon={RotateCcw} title="No company selected" />;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns Intake</h1>
        <p className="text-sm text-muted-foreground">
          Process returns with condition-based routing · Each return generates an auditable stock movement
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-base flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-primary" />
                {step === 'form' ? 'Log Return' : step === 'confirm' ? 'Confirm Return' : 'Return Processed'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {step === 'form' && (
                <div className="space-y-5">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order Number</label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text" placeholder="e.g. WOO-10421"
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

                  {matchedOrder && matchedOrder.order_items && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Item</label>
                      <div className="space-y-2">
                        {matchedOrder.order_items.map(item => (
                          <button
                            key={item.id}
                            onClick={() => setSelectedItemId(item.id)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-md border text-sm transition-colors ${
                              selectedItemId === item.id
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                            }`}
                          >
                            <span className="font-mono text-xs">{item.sku || '—'}</span>
                            <span>Qty: {item.quantity}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

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

                  {selectedItemId && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return Condition</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {(Object.entries(conditionConfig) as [ReturnCondition, typeof conditionConfig[ReturnCondition]][]).map(
                          ([key, cfg]) => (
                            <button
                              key={key}
                              onClick={() => setCondition(key)}
                              className={`flex items-start gap-3 p-4 rounded-lg border text-left transition-all ${
                                condition === key
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                                  : 'border-border bg-card hover:border-muted-foreground'
                              }`}
                            >
                              <div className={`mt-0.5 ${condition === key ? 'text-primary' : 'text-muted-foreground'}`}>
                                {cfg.icon}
                              </div>
                              <div className="space-y-1">
                                <div className="text-sm font-medium text-foreground">{cfg.label}</div>
                                <div className="text-xs text-muted-foreground leading-relaxed">{cfg.description}</div>
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {condition && (
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

                  <Button onClick={handleSubmit} disabled={!canProceed} className="w-full sm:w-auto">
                    Review Return <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              )}

              {step === 'confirm' && condition && matchedOrder && matchedItem && (
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
                        <p className="text-foreground">{quantity}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Condition</span>
                        <p><span className={`status-badge ${conditionConfig[condition].statusClass}`}>{conditionConfig[condition].label}</span></p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Stock Outcome</span>
                        <p className="text-foreground capitalize">{conditionConfig[condition].stockOutcome.replace(/_/g, ' ')}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep('form')}>Back</Button>
                    <Button onClick={handleConfirm}>
                      <CheckCircle2 className="w-4 h-4" /> Confirm & Process Return
                    </Button>
                  </div>
                </div>
              )}

              {step === 'done' && (
                <div className="text-center py-8 space-y-4">
                  <div className="w-14 h-14 rounded-full bg-success/15 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-7 h-7 text-success" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Return Processed</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Return recorded. Stock movement will be generated based on the outcome.
                    </p>
                  </div>
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="w-4 h-4" /> Process Another Return
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {matchedProduct && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Product Info</CardTitle>
                <CardDescription className="font-mono text-xs">{matchedProduct.sku}</CardDescription>
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
        </div>
      </div>
    </div>
  );
}

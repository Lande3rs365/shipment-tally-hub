import { useState } from "react";
import { mockInventory, mockOrders } from "@/data/mockData";
import type { MovementType, MovementDirection, InventoryStatusType } from "@/data/mockData";
import StatusBadge from "@/components/StatusBadge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  RotateCcw, PackageCheck, ShieldAlert, Search as SearchIcon,
  AlertTriangle, ClipboardCheck,
  CheckCircle2, ArrowRight
} from "lucide-react";

type ReturnCondition = 'resellable' | 'damaged' | 'defective' | 'inspection-required';

interface ReturnAttachment {
  file: File;
  preview: string;
  type: 'image' | 'video';
}

interface ReturnEntry {
  id: string;
  orderId: string;
  sku: string;
  productName: string;
  quantity: number;
  condition: ReturnCondition;
  notes: string;
  attachmentCount: number;
  timestamp: string;
  movementType: MovementType;
  direction: MovementDirection;
  stockOutcome: string;
}

const conditionConfig: Record<ReturnCondition, {
  label: string;
  icon: JSX.Element;
  statusClass: string;
  description: string;
  movementType: MovementType;
  direction: MovementDirection;
  stockOutcome: string;
}> = {
  resellable: {
    label: 'Resellable',
    icon: <PackageCheck className="w-5 h-5" />,
    statusClass: 'status-in-stock',
    description: 'Item in original condition — restock to available inventory',
    movementType: 'RETURN_RESTOCKED',
    direction: 'IN',
    stockOutcome: 'Restocked → Available Inventory',
  },
  damaged: {
    label: 'Damaged',
    icon: <AlertTriangle className="w-5 h-5" />,
    statusClass: 'status-out-of-stock',
    description: 'Physical damage — route to quarantine for warehouse review',
    movementType: 'RETURN_QUARANTINE',
    direction: 'MOVE',
    stockOutcome: 'Quarantined → Warehouse Review',
  },
  defective: {
    label: 'Defective',
    icon: <ShieldAlert className="w-5 h-5" />,
    statusClass: 'status-exception',
    description: 'Product defect — route to warranty / QA inspection',
    movementType: 'RETURN_DEFECTIVE',
    direction: 'MOVE',
    stockOutcome: 'Defective Hold → QA Inspection',
  },
  'inspection-required': {
    label: 'Inspection Required',
    icon: <ClipboardCheck className="w-5 h-5" />,
    statusClass: 'status-low-stock',
    description: 'Condition unclear — hold for manual assessment before any stock movement',
    movementType: 'RETURN_QUARANTINE',
    direction: 'MOVE',
    stockOutcome: 'On Hold → Pending Inspection',
  },
};

export default function ReturnsPage() {
  const [step, setStep] = useState<'form' | 'confirm' | 'done'>('form');
  const [orderId, setOrderId] = useState('');
  const [selectedSku, setSelectedSku] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [condition, setCondition] = useState<ReturnCondition | null>(null);
  const [notes, setNotes] = useState('');
  const [attachments, setAttachments] = useState<ReturnAttachment[]>([]);
  const [processedReturns, setProcessedReturns] = useState<ReturnEntry[]>([]);

  const matchedOrder = mockOrders.find(o => o.orderId.toLowerCase() === orderId.trim().toLowerCase());
  const matchedItem = matchedOrder?.items.find(i => i.sku === selectedSku);
  const inventoryItem = mockInventory.find(i => i.sku === selectedSku);

  const canProceed = matchedOrder && selectedSku && condition && quantity > 0;

  function handleSubmit() {
    if (!condition || !matchedOrder || !matchedItem) return;
    setStep('confirm');
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    const newAttachments: ReturnAttachment[] = Array.from(files).map(file => ({
      file,
      preview: URL.createObjectURL(file),
      type: file.type.startsWith('video/') ? 'video' : 'image',
    }));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  }

  function removeAttachment(index: number) {
    setAttachments(prev => {
      const removed = prev[index];
      URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }

  function handleConfirm() {
    if (!condition || !matchedOrder || !matchedItem) return;
    const cfg = conditionConfig[condition];
    const entry: ReturnEntry = {
      id: `RET-${Date.now()}`,
      orderId: matchedOrder.orderId,
      sku: selectedSku,
      productName: matchedItem.name,
      quantity,
      condition,
      notes,
      attachmentCount: attachments.length,
      timestamp: new Date().toISOString(),
      movementType: cfg.movementType,
      direction: cfg.direction,
      stockOutcome: cfg.stockOutcome,
    };
    setProcessedReturns(prev => [entry, ...prev]);
    attachments.forEach(a => URL.revokeObjectURL(a.preview));
    setStep('done');
  }

  function handleReset() {
    setStep('form');
    setOrderId('');
    setSelectedSku('');
    setQuantity(1);
    setCondition(null);
    setNotes('');
    setAttachments([]);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Returns Intake</h1>
        <p className="text-sm text-muted-foreground">
          Process returns with condition-based routing · Each return generates an auditable stock movement
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Main Form ── */}
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
                  {/* Order lookup */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Order ID</label>
                    <div className="relative">
                      <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="e.g. WOO-10421"
                        value={orderId}
                        onChange={e => { setOrderId(e.target.value); setSelectedSku(''); }}
                        className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    {orderId && !matchedOrder && (
                      <p className="text-xs text-destructive">No order found for "{orderId}"</p>
                    )}
                    {matchedOrder && (
                      <p className="text-xs text-success">
                        Found: {matchedOrder.customerName} · {matchedOrder.items.length} item(s)
                      </p>
                    )}
                  </div>

                  {/* SKU selection */}
                  {matchedOrder && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Select Item</label>
                      <div className="space-y-2">
                        {matchedOrder.items.map(item => (
                          <button
                            key={item.sku}
                            onClick={() => setSelectedSku(item.sku)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-md border text-sm transition-colors ${
                              selectedSku === item.sku
                                ? 'border-primary bg-primary/10 text-foreground'
                                : 'border-border bg-card text-muted-foreground hover:border-muted-foreground'
                            }`}
                          >
                            <span className="font-mono text-xs">{item.sku}</span>
                            <span>{item.name}</span>
                            <span className="text-xs">Qty: {item.quantity}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Quantity */}
                  {selectedSku && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Return Quantity</label>
                      <input
                        type="number"
                        min={1}
                        max={matchedItem?.quantity || 1}
                        value={quantity}
                        onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                        className="w-24 bg-card border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                  )}

                  {/* Condition routing */}
                  {selectedSku && (
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
                                <div className={`status-badge ${cfg.statusClass} mt-1`}>{cfg.stockOutcome}</div>
                              </div>
                            </button>
                          )
                        )}
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {condition && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes (optional)</label>
                      <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        placeholder="Describe the item condition, packaging state, etc."
                        rows={3}
                        className="w-full bg-card border border-border rounded-md px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                      />
                    </div>
                  )}

                  {/* Photo / Video upload */}
                  {condition && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        Inspection Photos / Video
                      </label>
                      <p className="text-xs text-muted-foreground">
                        Upload photos or a short video of the returned item for the inspection team.
                      </p>

                      <div className="flex flex-wrap gap-3">
                        {attachments.map((att, i) => (
                          <div key={i} className="relative w-20 h-20 rounded-lg border border-border overflow-hidden bg-muted/30 group">
                            {att.type === 'image' ? (
                              <img src={att.preview} alt={`Return attachment ${i + 1}`} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Camera className="w-6 h-6 text-muted-foreground" />
                                <span className="absolute bottom-1 text-[9px] text-muted-foreground">Video</span>
                              </div>
                            )}
                            <button
                              onClick={() => removeAttachment(i)}
                              className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/90 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        <label className="w-20 h-20 rounded-lg border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors">
                          <ImageIcon className="w-5 h-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">Add</span>
                          <input
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleFileChange}
                            className="hidden"
                          />
                        </label>
                      </div>
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
                        <p className="font-mono text-primary">{matchedOrder.orderId}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Customer</span>
                        <p className="text-foreground">{matchedOrder.customerName}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">SKU</span>
                        <p className="font-mono text-foreground">{selectedSku}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Product</span>
                        <p className="text-foreground">{matchedItem.name}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Quantity</span>
                        <p className="text-foreground">{quantity}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Condition</span>
                        <p><span className={`status-badge ${conditionConfig[condition].statusClass}`}>{conditionConfig[condition].label}</span></p>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-border">
                      <span className="text-xs text-muted-foreground uppercase tracking-wider">Stock Movement</span>
                      <p className="text-sm text-foreground mt-1">
                        <span className="font-mono text-xs text-info">{conditionConfig[condition].movementType}</span>
                        {' → '}
                        <span className={`status-badge ${conditionConfig[condition].statusClass}`}>{conditionConfig[condition].stockOutcome}</span>
                      </p>
                    </div>
                    {notes && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Notes</span>
                        <p className="text-sm text-foreground mt-1">{notes}</p>
                      </div>
                    )}
                    {attachments.length > 0 && (
                      <div className="pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Attachments</span>
                        <div className="flex gap-2 mt-2">
                          {attachments.map((att, i) => (
                            <div key={i} className="w-14 h-14 rounded border border-border overflow-hidden">
                              {att.type === 'image' ? (
                                <img src={att.preview} alt={`Attachment ${i + 1}`} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-muted/30">
                                  <Camera className="w-4 h-4 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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
                      Stock movement recorded in the ledger. Inventory updated accordingly.
                    </p>
                  </div>
                  <Button onClick={handleReset} variant="outline">
                    <RotateCcw className="w-4 h-4" /> Process Another Return
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Processed returns log */}
          {processedReturns.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Recent Returns ({processedReturns.length})</CardTitle>
                <CardDescription>Returns processed this session — movements logged to stock ledger</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                        <th className="text-left py-2 px-3">Return ID</th>
                        <th className="text-left py-2 px-3">Order</th>
                        <th className="text-left py-2 px-3">SKU</th>
                        <th className="text-right py-2 px-3">Qty</th>
                        <th className="text-left py-2 px-3">Condition</th>
                        <th className="text-left py-2 px-3">Stock Outcome</th>
                        <th className="text-left py-2 px-3">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedReturns.map(r => (
                        <tr key={r.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-mono text-xs text-primary">{r.id}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{r.orderId}</td>
                          <td className="py-2.5 px-3 font-mono text-xs">{r.sku}</td>
                          <td className="py-2.5 px-3 text-right font-mono">{r.quantity}</td>
                          <td className="py-2.5 px-3">
                            <span className={`status-badge ${conditionConfig[r.condition].statusClass}`}>
                              {conditionConfig[r.condition].label}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">{r.stockOutcome}</td>
                          <td className="py-2.5 px-3 text-xs text-muted-foreground">
                            {new Date(r.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Sidebar: Inventory context + Calendly ── */}
        <div className="space-y-4">
          {/* SKU inventory context */}
          {inventoryItem && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Inventory Snapshot</CardTitle>
                <CardDescription className="font-mono text-xs">{inventoryItem.sku}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Stock on Hand</span>
                  <span className="font-mono font-medium text-foreground">{inventoryItem.stockOnHand}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-mono font-medium text-success">{inventoryItem.availableStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Damaged</span>
                  <span className="font-mono font-medium text-destructive">{inventoryItem.damagedStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Defective</span>
                  <span className="font-mono font-medium text-destructive">{inventoryItem.defectiveStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Quarantine</span>
                  <span className="font-mono font-medium text-warning">{inventoryItem.quarantineStock}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Returns (Total)</span>
                  <span className="font-mono font-medium text-foreground">{inventoryItem.returnedQuantity}</span>
                </div>
                <div className="pt-2 border-t border-border flex justify-between items-center">
                  <span className="text-muted-foreground">Status</span>
                  <StatusBadge status={inventoryItem.status} />
                </div>
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

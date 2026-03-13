import { useState } from "react";
import StatusBadge from "@/components/StatusBadge";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useManufacturerManifests, useProducts, useStockLocations } from "@/hooks/useSupabaseData";
import { useCompany } from "@/contexts/CompanyContext";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import KpiCard from "@/components/KpiCard";
import {
  Ship, Search, Package, AlertTriangle, Clock, CheckCircle,
  Plus, X, Truck, Calendar
} from "lucide-react";
import { toast } from "sonner";

const statusFilters = ['all', 'pending', 'partially_received', 'received', 'closed'] as const;

interface NewLineItem {
  productId: string;
  sku: string;
  expectedQty: number;
}

export default function SupplierManifestsPage() {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<string>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);

  // New manifest form
  const [formData, setFormData] = useState({
    manufacturerName: '',
    manifestNumber: '',
    requestDate: '',
    expectedDate: '',
    shipmentDate: '',
    trackingNumber: '',
    eta: '',
    notes: '',
  });
  const [lineItems, setLineItems] = useState<NewLineItem[]>([{ productId: '', sku: '', expectedQty: 0 }]);

  const { currentCompany } = useCompany();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: manifests = [], isLoading } = useManufacturerManifests();
  const { data: products = [] } = useProducts();
  const { data: locations = [] } = useStockLocations();

  const filtered = manifests
    .filter(m => filter === 'all' || m.status === filter)
    .filter(m =>
      (m.manifest_number || '').toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer_name.toLowerCase().includes(search.toLowerCase()) ||
      (m.tracking_number || '').toLowerCase().includes(search.toLowerCase()) ||
      m.manufacturer_manifest_items.some(r => (r.sku || '').toLowerCase().includes(search.toLowerCase()))
    );

  const totalExpected = manifests.filter(m => ['pending'].includes(m.status)).length;
  const totalReceived = manifests.filter(m => m.status === 'received' || m.status === 'closed').length;
  const totalIssues = manifests.filter(m => m.status === 'partially_received').length;

  const addLineItem = () => setLineItems([...lineItems, { productId: '', sku: '', expectedQty: 0 }]);
  const removeLineItem = (i: number) => setLineItems(lineItems.filter((_, idx) => idx !== i));
  const updateLineItem = (i: number, field: keyof NewLineItem, value: any) => {
    const updated = [...lineItems];
    (updated[i] as any)[field] = value;
    if (field === 'productId') {
      const p = products.find(pr => pr.id === value);
      updated[i].sku = p?.sku || '';
    }
    setLineItems(updated);
  };

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCompany) return;

    try {
      const { data: manifest, error } = await supabase.from('manufacturer_manifests').insert({
        company_id: currentCompany.id,
        manifest_number: formData.manifestNumber || null,
        manufacturer_name: formData.manufacturerName,
        status: 'pending',
        request_date: formData.requestDate || null,
        expected_date: formData.expectedDate || null,
        shipment_date: formData.shipmentDate || null,
        tracking_number: formData.trackingNumber || null,
        eta: formData.eta || null,
        location_id: locations[0]?.id || null,
        notes: formData.notes || null,
      }).select('id').single();

      if (error) throw error;

      if (manifest) {
        const items = lineItems.filter(l => l.productId && l.expectedQty > 0).map(l => ({
          manifest_id: manifest.id,
          product_id: l.productId,
          sku: l.sku,
          expected_qty: l.expectedQty,
        }));
        if (items.length > 0) {
          const { error: itemsError } = await supabase.from('manufacturer_manifest_items').insert(items);
          if (itemsError) throw itemsError;
        }
      }

      queryClient.invalidateQueries({ queryKey: ['manufacturer_manifests'] });
      setShowNewForm(false);
      setFormData({ manufacturerName: '', manifestNumber: '', requestDate: '', expectedDate: '', shipmentDate: '', trackingNumber: '', eta: '', notes: '' });
      setLineItems([{ productId: '', sku: '', expectedQty: 0 }]);
    } catch (err) {
      toast.error('Failed to create manifest');
    }
  };

  // Receive items state
  const [receiveQtys, setReceiveQtys] = useState<Record<string, { received: number; damaged: number }>>({});

  const startReceiving = (manifestId: string, items: any[]) => {
    setReceivingId(manifestId);
    const qtys: Record<string, { received: number; damaged: number }> = {};
    items.forEach(item => { qtys[item.id] = { received: item.received_qty || 0, damaged: item.damaged_qty || 0 }; });
    setReceiveQtys(qtys);
  };

  const handleReceive = async (manifestId: string, items: any[]) => {
    if (!currentCompany) return;
    const primaryLocation = locations[0];

    try {
      for (const item of items) {
        const qty = receiveQtys[item.id];
        if (!qty) continue;
        const shortQty = Math.max(0, item.expected_qty - qty.received - qty.damaged);
        const status = qty.received >= item.expected_qty ? 'received'
          : qty.received > 0 ? (shortQty > 0 ? 'short' : 'partial')
          : 'pending';

        const { error: updateErr } = await supabase.from('manufacturer_manifest_items').update({
          received_qty: qty.received,
          damaged_qty: qty.damaged,
          short_qty: shortQty,
          status,
        }).eq('id', item.id);
        if (updateErr) throw updateErr;

        if (qty.received > 0 && item.product_id) {
          const { error: mvErr } = await supabase.from('stock_movements').insert({
            company_id: currentCompany.id,
            product_id: item.product_id,
            sku: item.sku,
            direction: 'IN',
            movement_type: 'purchase_receive',
            quantity: qty.received,
            to_location_id: primaryLocation?.id || null,
            linked_manifest_id: manifestId,
            reason_code: 'Manufacturer inbound receipt',
            performed_by: user?.id || null,
          });
          if (mvErr) throw mvErr;
        }

        if (primaryLocation && item.product_id && qty.received > 0) {
          const { data: existing } = await supabase
            .from('inventory')
            .select('id, on_hand, available, damaged')
            .eq('product_id', item.product_id)
            .eq('location_id', primaryLocation.id)
            .maybeSingle();

          if (existing) {
            const { error: invErr } = await supabase.from('inventory').update({
              on_hand: existing.on_hand + qty.received,
              available: existing.available + qty.received,
              damaged: existing.damaged + qty.damaged,
            }).eq('id', existing.id);
            if (invErr) throw invErr;
          }
        }
      }

      const allReceived = items.every(i => (receiveQtys[i.id]?.received || 0) >= i.expected_qty);
      const someReceived = items.some(i => (receiveQtys[i.id]?.received || 0) > 0);
      const newStatus = allReceived ? 'received' : someReceived ? 'partially_received' : 'pending';

      const { error: manifestErr } = await supabase.from('manufacturer_manifests').update({
        status: newStatus,
        received_date: someReceived ? new Date().toISOString() : null,
      }).eq('id', manifestId);
      if (manifestErr) throw manifestErr;

      queryClient.invalidateQueries({ queryKey: ['manufacturer_manifests'] });
      queryClient.invalidateQueries({ queryKey: ['stock_movements'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      setReceivingId(null);
    } catch (err) {
      toast.error('Failed to record receipt');
    }
  };

  if (!currentCompany) return <EmptyState icon={Ship} title="No company selected" />;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl md:text-2xl font-bold">Manufacturer Inbound</h1>
          <p className="text-sm text-muted-foreground">{manifests.length} manifests · Inbound stock tracking</p>
        </div>
        <Button onClick={() => setShowNewForm(!showNewForm)} size="sm">
          <Plus className="w-4 h-4" /> New Manifest
        </Button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard title="Pending" value={totalExpected} icon={Clock} variant="warning" />
        <KpiCard title="Partially Received" value={totalIssues} icon={AlertTriangle} variant="danger" />
        <KpiCard title="Received / Closed" value={totalReceived} icon={CheckCircle} variant="success" />
        <KpiCard title="Total Manifests" value={manifests.length} icon={Ship} variant="info" />
      </div>

      {/* New Manifest Form */}
      {showNewForm && (
        <form onSubmit={handleCreateManifest} className="bg-card border border-border rounded-lg p-5 space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Create Manufacturer Manifest</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Manufacturer *</label>
              <input required value={formData.manufacturerName} onChange={e => setFormData({ ...formData, manufacturerName: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Manifest #</label>
              <input value={formData.manifestNumber} onChange={e => setFormData({ ...formData, manifestNumber: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Tracking #</label>
              <input value={formData.trackingNumber} onChange={e => setFormData({ ...formData, trackingNumber: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3 h-3" /> Request Date</label>
              <input type="date" value={formData.requestDate} onChange={e => setFormData({ ...formData, requestDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Shipment Date</label>
              <input type="date" value={formData.shipmentDate} onChange={e => setFormData({ ...formData, shipmentDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Expected Date</label>
              <input type="date" value={formData.expectedDate} onChange={e => setFormData({ ...formData, expectedDate: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">ETA</label>
              <input type="date" value={formData.eta} onChange={e => setFormData({ ...formData, eta: e.target.value })}
                className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>

          {/* Line Items */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted-foreground uppercase tracking-wider">Line Items</label>
              <button type="button" onClick={addLineItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                <Plus className="w-3 h-3" /> Add Line
              </button>
            </div>
            {lineItems.map((item, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select value={item.productId} onChange={e => updateLineItem(i, 'productId', e.target.value)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="">Select product...</option>
                    {products.map(p => <option key={p.id} value={p.id}>{p.sku} — {p.name}</option>)}
                  </select>
                </div>
                <div className="w-28">
                  <input type="number" min={0} placeholder="Exp Qty" value={item.expectedQty || ''} onChange={e => updateLineItem(i, 'expectedQty', parseInt(e.target.value) || 0)}
                    className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                {lineItems.length > 1 && (
                  <button type="button" onClick={() => removeLineItem(i)} className="p-2 text-muted-foreground hover:text-destructive">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground uppercase tracking-wider">Notes</label>
            <input value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Optional notes..."
              className="w-full bg-background border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setShowNewForm(false)}>Cancel</Button>
            <Button type="submit">Create Manifest</Button>
          </div>
        </form>
      )}

      {/* Filter row: tabs + search on same line */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {statusFilters.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${
                filter === s
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-muted-foreground border-border hover:bg-muted'
              }`}
            >
              {s === 'all' ? `All (${manifests.length})` : `${s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())} (${manifests.filter(m => m.status === s).length})`}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-0 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text" placeholder="Search manifest, manufacturer, tracking, SKU..."
            value={search} onChange={e => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-md pl-9 pr-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <span className="text-xs text-muted-foreground sm:ml-auto whitespace-nowrap">
          Showing {filtered.length} of {manifests.length}
        </span>
      </div>

      {isLoading ? <LoadingSpinner message="Loading manifests..." /> : filtered.length === 0 ? (
        <EmptyState icon={Ship} title="No manifests" description="Click '+ New Manifest' to create one." />
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                  <th className="text-left py-3 px-4">Manifest</th>
                  <th className="text-left py-3 px-4">Manufacturer</th>
                  <th className="text-left py-3 px-4">Tracking</th>
                  <th className="text-left py-3 px-4">Expected</th>
                  <th className="text-left py-3 px-4">ETA</th>
                  <th className="text-center py-3 px-4">Lines</th>
                  <th className="text-left py-3 px-4">Status</th>
                  <th className="text-left py-3 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(m => {
                  const isExpanded = expandedId === m.id;
                  const isReceiving = receivingId === m.id;
                  return (
                    <> 
                      <tr
                        key={m.id}
                        onClick={() => !isReceiving && setExpandedId(isExpanded ? null : m.id)}
                        className="border-b border-border/50 hover:bg-muted/20 transition-colors cursor-pointer"
                      >
                        <td className="py-3 px-4 font-mono text-primary font-medium">{m.manifest_number || '—'}</td>
                        <td className="py-3 px-4 text-foreground">{m.manufacturer_name}</td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {m.tracking_number ? (
                            <span className="flex items-center gap-1"><Truck className="w-3 h-3" />{m.tracking_number}</span>
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {m.expected_date ? new Date(m.expected_date).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-muted-foreground">
                          {m.eta ? new Date(m.eta).toLocaleDateString() : '—'}
                        </td>
                        <td className="py-3 px-4 text-center font-mono text-foreground">{m.manufacturer_manifest_items.length}</td>
                        <td className="py-3 px-4"><StatusBadge status={m.status} /></td>
                        <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                          {m.status !== 'received' && m.status !== 'closed' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => startReceiving(m.id, m.manufacturer_manifest_items)}
                              className="text-xs"
                            >
                              Receive
                            </Button>
                          )}
                        </td>
                      </tr>
                      {(isExpanded || isReceiving) && (
                        <tr key={`${m.id}-detail`}>
                          <td colSpan={8} className="bg-muted/10 px-4 py-3">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Line Items — {m.manifest_number}
                            </p>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-muted-foreground uppercase tracking-wider">
                                  <th className="text-left py-1.5 px-2">SKU</th>
                                  <th className="text-right py-1.5 px-2">Expected</th>
                                  <th className="text-right py-1.5 px-2">Received</th>
                                  <th className="text-right py-1.5 px-2">Damaged</th>
                                  <th className="text-right py-1.5 px-2">Short</th>
                                  <th className="text-left py-1.5 px-2">Status</th>
                                </tr>
                              </thead>
                              <tbody>
                                {m.manufacturer_manifest_items.map(r => (
                                  <tr key={r.id} className="border-t border-border/30">
                                    <td className="py-1.5 px-2 font-mono text-primary">{r.sku || '—'}</td>
                                    <td className="py-1.5 px-2 text-right font-mono text-foreground">{r.expected_qty}</td>
                                    <td className="py-1.5 px-2 text-right">
                                      {isReceiving ? (
                                        <input type="number" min={0} max={r.expected_qty}
                                          value={receiveQtys[r.id]?.received || 0}
                                          onChange={e => setReceiveQtys({ ...receiveQtys, [r.id]: { ...receiveQtys[r.id], received: parseInt(e.target.value) || 0 } })}
                                          className="w-16 bg-background border border-border rounded px-2 py-1 text-right font-mono text-foreground" />
                                      ) : (
                                        <span className="font-mono text-foreground">{r.received_qty || '—'}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-right">
                                      {isReceiving ? (
                                        <input type="number" min={0}
                                          value={receiveQtys[r.id]?.damaged || 0}
                                          onChange={e => setReceiveQtys({ ...receiveQtys, [r.id]: { ...receiveQtys[r.id], damaged: parseInt(e.target.value) || 0 } })}
                                          className="w-16 bg-background border border-border rounded px-2 py-1 text-right font-mono text-foreground" />
                                      ) : (
                                        <span className="font-mono text-destructive">{r.damaged_qty || '—'}</span>
                                      )}
                                    </td>
                                    <td className="py-1.5 px-2 text-right font-mono text-warning">{r.short_qty || '—'}</td>
                                    <td className="py-1.5 px-2"><StatusBadge status={r.status} /></td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {isReceiving && (
                              <div className="flex justify-end gap-2 mt-3">
                                <Button size="sm" variant="outline" onClick={() => setReceivingId(null)}>Cancel</Button>
                                <Button size="sm" onClick={() => handleReceive(m.id, m.manufacturer_manifest_items)}>
                                  <CheckCircle className="w-3.5 h-3.5" /> Confirm Receipt
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

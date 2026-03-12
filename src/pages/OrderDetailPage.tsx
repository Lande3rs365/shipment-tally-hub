import { useParams, Link } from "react-router-dom";
import { useState } from "react";
import { useOrder, useOrderEvents, useOrderShipments } from "@/hooks/useSupabaseData";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import StatusBadge from "@/components/StatusBadge";
import LoadingSpinner from "@/components/LoadingSpinner";
import { ArrowLeft, Package, Clock, Truck, MapPin, Phone, Mail, MessageSquare, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const { data: order, isLoading } = useOrder(orderId);
  const { data: events = [] } = useOrderEvents(order?.id);
  const { data: shipments = [] } = useOrderShipments(order?.id);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [noteType, setNoteType] = useState("note");
  const [submitting, setSubmitting] = useState(false);

  const addNote = async () => {
    if (!note.trim() || !order || !user) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from("order_events").insert({
        order_id: order.id,
        event_type: noteType,
        description: note.trim(),
        created_by: user.id,
      });
      if (error) throw error;
      setNote("");
      queryClient.invalidateQueries({ queryKey: ["order_events", order.id] });
    } catch (err: any) {
      toast({ title: "Failed to save note", description: err.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  if (isLoading) return <div className="p-6"><LoadingSpinner message="Loading order..." /></div>;

  if (!order) {
    return (
      <div className="p-6">
        <Link to="/orders" className="text-primary hover:underline text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to Orders
        </Link>
        <p className="mt-4 text-muted-foreground">Order not found.</p>
      </div>
    );
  }

  const eventTypeLabels: Record<string, { label: string; color: string }> = {
    import_created: { label: "Created via import", color: "text-success" },
    import_updated: { label: "Updated via import", color: "text-info" },
    customer_contacted: { label: "Customer contacted", color: "text-primary" },
    department_chased: { label: "Department chased", color: "text-warning" },
    note: { label: "Note", color: "text-muted-foreground" },
    status_change: { label: "Status change", color: "text-info" },
  };

  const noteTypes = [
    { value: "note", label: "Note" },
    { value: "customer_contacted", label: "Customer Contacted" },
    { value: "department_chased", label: "Department Chased" },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/orders" className="text-primary hover:underline text-sm flex items-center gap-1">
        <ArrowLeft className="w-4 h-4" /> Back to Orders
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">{order.order_number}</h1>
          <p className="text-sm text-muted-foreground">{order.customer_name} · {order.customer_email}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={order.woo_status || 'processing'} />
          <StatusBadge status={order.status} />
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Woo Status</p>
          <StatusBadge status={order.woo_status || 'processing'} />
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Source</p>
          <p className="text-foreground font-medium text-sm">{order.source || '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Total</p>
          <p className="text-foreground font-mono font-medium text-sm">{order.total_amount != null ? `$${order.total_amount}` : '—'}</p>
        </div>
        <div className="bg-card border border-border rounded-lg p-4">
          <p className="text-xs text-muted-foreground uppercase">Order Date</p>
          <p className="text-foreground font-mono text-xs">{order.order_date ? new Date(order.order_date).toLocaleDateString() : '—'}</p>
        </div>
      </div>

      {/* Customer Info */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Customer Details</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase">Shipping Address</p>
              <p className="text-foreground">{order.shipping_address || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Phone className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase">Phone</p>
              <p className="text-foreground">{order.customer_phone || '—'}</p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground uppercase">Email</p>
              <p className="text-foreground">{order.customer_email || '—'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3">Order Items</h2>
        {order.order_items.length === 0 ? (
          <p className="text-xs text-muted-foreground">No items.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground text-xs uppercase tracking-wider border-b border-border">
                <th className="text-left py-2 px-3">SKU</th>
                <th className="text-right py-2 px-3">Qty</th>
                <th className="text-right py-2 px-3">Unit Price</th>
                <th className="text-right py-2 px-3">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {order.order_items.map(item => (
                <tr key={item.id} className="border-b border-border/30">
                  <td className="py-2 px-3 font-mono text-primary">{item.sku || '—'}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{item.quantity}</td>
                  <td className="py-2 px-3 text-right font-mono text-muted-foreground">{item.unit_price != null ? `$${item.unit_price}` : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono text-foreground">{item.line_total != null ? `$${item.line_total}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Shipments */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <Truck className="w-4 h-4 text-primary" /> Shipments
        </h2>
        {shipments.length === 0 ? (
          <p className="text-xs text-muted-foreground">No shipments recorded for this order.</p>
        ) : (
          <div className="space-y-3">
            {shipments.map(s => (
              <div key={s.id} className="bg-muted/30 border border-border/50 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono text-primary font-medium text-sm">{s.shipment_number || s.tracking_number || '—'}</span>
                  <StatusBadge status={s.status} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Carrier</span><p className="text-foreground">{s.carrier || '—'}</p></div>
                  <div><span className="text-muted-foreground">Tracking</span><p className="font-mono text-foreground">{s.tracking_number || '—'}</p></div>
                  <div><span className="text-muted-foreground">Shipped</span><p className="text-foreground">{s.shipped_date ? new Date(s.shipped_date).toLocaleDateString() : '—'}</p></div>
                  <div><span className="text-muted-foreground">Delivered</span><p className="text-foreground">{s.delivered_date ? new Date(s.delivered_date).toLocaleDateString() : '—'}</p></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Note / Activity */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary" /> Add Note / Action
        </h2>
        <div className="flex gap-2 mb-3">
          {noteTypes.map(t => (
            <button
              key={t.value}
              onClick={() => setNoteType(t.value)}
              className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${
                noteType === t.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:border-primary/50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addNote()}
            placeholder={noteType === "customer_contacted" ? "e.g. Emailed customer about payment status" : noteType === "department_chased" ? "e.g. Chased warehouse for update on hold" : "Add a note..."}
            className="flex-1 bg-muted border border-border rounded-md px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            onClick={addNote}
            disabled={!note.trim() || submitting}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Event Timeline */}
      <div className="bg-card border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" /> Activity Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No activity recorded for this order.</p>
        ) : (
          <div className="relative ml-3">
            <div className="absolute left-0 top-0 bottom-0 w-px bg-border" />
            <div className="space-y-4">
              {[...events].reverse().map(ev => {
                const meta = eventTypeLabels[ev.event_type] || { label: ev.event_type, color: "text-muted-foreground" };
                return (
                  <div key={ev.id} className="relative pl-6">
                    <div className="absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card" />
                    <div>
                      <span className={`text-xs font-medium ${meta.color}`}>{meta.label}</span>
                      <p className="text-sm text-foreground">{ev.description || '—'}</p>
                      <p className="text-xs text-muted-foreground font-mono">{new Date(ev.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

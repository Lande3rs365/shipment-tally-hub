import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, string> = {
  // Order statuses — strict color coding
  'processing': 'status-processing',       // blue
  'completed': 'status-shipped',            // green
  'on-hold': 'status-on-hold',             // orange
  'on_hold': 'status-on-hold',             // orange (underscore variant)
  'cancelled': 'status-exception',          // red
  'refunded': 'status-exception',           // red
  'pending': 'status-muted',               // grey/muted
  'failed': 'status-exception',             // red

  // Shipment statuses
  'shipped': 'status-shipped',              // green
  'delivered': 'status-shipped',            // green
  'in-transit': 'status-processing',        // blue
  'in_transit': 'status-processing',        // blue
  'label-created': 'status-muted',          // grey
  'label_created': 'status-muted',          // grey
  'not-shipped': 'status-exception',        // red
  'other': 'status-exception',              // red — carrier alert, needs urgent attention
  'packing': 'status-processing',           // blue
  'ready-to-ship': 'status-processing',     // blue

  // Inventory statuses
  'in-stock': 'status-shipped',             // green
  'low-stock': 'status-on-hold',            // orange
  'out-of-stock': 'status-exception',       // red
  'reserved': 'status-processing',          // blue
  'allocated': 'status-processing',         // blue
  'backordered': 'status-exception',        // red
  'awaiting-stock': 'status-on-hold',       // orange
  'awaiting-replenishment': 'status-on-hold', // orange
  'damaged': 'status-exception',            // red
  'defective': 'status-exception',          // red
  'in-quarantine': 'status-on-hold',        // orange

  // Exception severities
  'exception': 'status-exception',          // red
  'critical': 'status-exception',           // red
  'high': 'status-exception',               // red
  'medium': 'status-on-hold',              // orange
  'low': 'status-processing',              // blue
  'open': 'status-on-hold',                // orange

  // Manifest statuses
  'expected': 'status-processing',          // blue
  'received': 'status-shipped',             // green
  'partial-receipt': 'status-on-hold',      // orange
  'partial': 'status-on-hold',              // orange
  'short-receipt': 'status-exception',      // red
  'short': 'status-exception',              // red
  'damaged-on-arrival': 'status-exception', // red
  'overdue': 'status-exception',            // red

  // Exception reasons
  'oos': 'status-exception',                // red
  'refund_req': 'status-exception',         // red
  'cancellation_req': 'status-exception',   // red
  'need_shipping_dets': 'status-on-hold',   // orange
  'returned_item': 'status-on-hold',        // orange
  'customs': 'status-processing',           // blue
  'apac_order': 'status-processing',        // blue
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusMap[status] || 'status-muted';
  const label = status.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={cn("status-badge", style, className)}>
      {label}
    </span>
  );
}

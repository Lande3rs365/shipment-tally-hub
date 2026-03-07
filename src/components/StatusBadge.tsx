import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const statusMap: Record<string, string> = {
  'in-stock': 'status-in-stock',
  'low-stock': 'status-low-stock',
  'out-of-stock': 'status-out-of-stock',
  'reserved': 'status-reserved',
  'backordered': 'status-out-of-stock',
  'allocated': 'status-processing',
  'processing': 'status-processing',
  'completed': 'status-shipped',
  'on-hold': 'status-low-stock',
  'cancelled': 'status-exception',
  'not-shipped': 'status-exception',
  'label-created': 'status-low-stock',
  'in-transit': 'status-processing',
  'delivered': 'status-shipped',
  'shipped': 'status-shipped',
  'packing': 'status-processing',
  'ready-to-ship': 'status-processing',
  'awaiting-stock': 'status-low-stock',
  'exception': 'status-exception',
  'critical': 'status-exception',
  'high': 'status-out-of-stock',
  'medium': 'status-low-stock',
  'low': 'status-processing',
  'awaiting-replenishment': 'status-low-stock',
  'damaged': 'status-exception',
  'defective': 'status-exception',
  'in-quarantine': 'status-low-stock',
};

export default function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusMap[status] || 'status-processing';
  const label = status.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <span className={cn("status-badge", style, className)}>
      {label}
    </span>
  );
}

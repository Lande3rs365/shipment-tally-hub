import { forwardRef } from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const variantStyles = {
  default: 'before:bg-gradient-to-r before:from-muted-foreground before:to-transparent',
  success: 'before:bg-gradient-to-r before:from-success before:to-transparent',
  warning: 'before:bg-gradient-to-r before:from-warning before:to-transparent',
  danger: 'before:bg-gradient-to-r before:from-destructive before:to-transparent',
  info: 'before:bg-gradient-to-r before:from-info before:to-transparent',
};

const iconVariantStyles = {
  default: 'text-muted-foreground',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-destructive',
  info: 'text-info',
};

const KpiCard = forwardRef<HTMLDivElement, KpiCardProps>(
  ({ title, value, icon: Icon, trend, variant = 'default' }, ref) => {
    return (
      <div ref={ref} className={cn("kpi-card", variantStyles[variant])}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">{title}</p>
            <p className="text-2xl font-bold font-mono text-foreground">{value}</p>
            {trend && <p className="text-xs text-muted-foreground mt-1">{trend}</p>}
          </div>
          <Icon className={cn("w-5 h-5", iconVariantStyles[variant])} />
        </div>
      </div>
    );
  }
);

KpiCard.displayName = "KpiCard";

export default KpiCard;

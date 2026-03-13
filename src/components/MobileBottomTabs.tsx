import { useLocation, useNavigate } from "react-router-dom";
import { LayoutDashboard, Package, Warehouse, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMobileTabBadges } from "@/hooks/useMobileTabBadges";

const tabs = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, badgeKey: "exceptions" },
  { path: "/orders", label: "Orders", icon: Package, badgeKey: "processing" },
  { path: "/inventory", label: "Inventory", icon: Warehouse, badgeKey: "lowStock" },
  { path: "/shipments", label: "Shipments", icon: Truck, badgeKey: null },
] as const;

export default function MobileBottomTabs() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const badges = useMobileTabBadges();

  return (
    <nav className="flex items-stretch border-t border-border bg-sidebar shrink-0 safe-area-bottom">
      {tabs.map(tab => {
        const isActive = tab.path === "/" ? pathname === "/" : pathname.startsWith(tab.path);
        const count = tab.badgeKey ? badges[tab.badgeKey] : 0;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative",
              isActive
                ? "text-primary"
                : "text-muted-foreground active:text-foreground"
            )}
          >
            <span className="relative">
              <tab.icon className={cn("w-5 h-5", isActive && "text-primary")} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1 leading-none">
                  {count > 99 ? "99+" : count}
                </span>
              )}
            </span>
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

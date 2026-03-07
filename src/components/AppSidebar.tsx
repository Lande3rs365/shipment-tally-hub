import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Truck, Warehouse, Upload,
  AlertTriangle, FileText, ChevronLeft, ChevronRight,
  ArrowRightLeft, SlidersHorizontal
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/orders", icon: Package, label: "Orders" },
  { to: "/inventory", icon: Warehouse, label: "Inventory" },
  { to: "/shipments", icon: Truck, label: "Shipments" },
  { to: "/uploads", icon: Upload, label: "Data Intake" },
  { to: "/exceptions", icon: AlertTriangle, label: "Exceptions" },
  { to: "/exports", icon: FileText, label: "Exports" },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();

  return (
    <aside className={cn(
      "h-screen bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-200",
      collapsed ? "w-16" : "w-56"
    )}>
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground truncate">DistroHub</h1>
            <p className="text-[10px] text-sidebar-foreground">Operations Control</p>
          </div>
        )}
      </div>

      <nav className="flex-1 py-3 px-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent text-sm transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
        </button>
      </div>
    </aside>
  );
}

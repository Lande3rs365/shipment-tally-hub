import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Package, Truck, Warehouse, Upload,
  AlertTriangle, FileText, ChevronLeft, ChevronRight,
  ArrowRightLeft, Ship, RotateCcw, LogOut, Building2, ChevronsUpDown, Tag
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import InviteMemberDialog from "@/components/InviteMemberDialog";

const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/exceptions", icon: AlertTriangle, label: "Exceptions" },
  { to: "/orders", icon: Package, label: "Orders" },
  { to: "/shipments", icon: Truck, label: "Shipments" },
  { to: "/returns", icon: RotateCcw, label: "Returns" },
  { to: "/supplier-manifests", icon: Ship, label: "Manufacturer Inbound" },
  { to: "/inventory", icon: Warehouse, label: "Inventory" },
  { to: "/stock-movements", icon: ArrowRightLeft, label: "Stock Ledger" },
  { to: "/uploads", icon: Upload, label: "Data Intake" },
  { to: "/exports", icon: FileText, label: "Exports" },
];

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { user, signOut } = useAuth();
  const { companies, currentCompany, setCurrentCompany } = useCompany();

  const displayName = user?.user_metadata?.full_name || user?.email || "User";
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

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

      {/* Company Switcher */}
      {companies.length > 0 && (
        <div className="px-2 py-2 border-b border-sidebar-border">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors hover:bg-sidebar-accent",
                collapsed && "justify-center"
              )}>
                <Building2 className="w-4 h-4 shrink-0 text-primary" />
                {!collapsed && (
                  <>
                    <span className="flex-1 text-left truncate text-sidebar-accent-foreground text-xs font-medium">
                      {currentCompany?.name || "Select company"}
                    </span>
                    <ChevronsUpDown className="w-3 h-3 text-sidebar-foreground shrink-0" />
                  </>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="start" className="w-48">
              {companies.map(company => (
                <DropdownMenuItem
                  key={company.id}
                  onClick={() => setCurrentCompany(company)}
                  className={cn(
                    "text-xs cursor-pointer",
                    currentCompany?.id === company.id && "bg-accent font-medium"
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 mr-2" />
                  {company.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {!collapsed && <InviteMemberDialog />}
        </div>
      )}

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

      <div className="p-2 border-t border-sidebar-border space-y-1">
        {user && (
          <div className={cn(
            "flex items-center gap-3 px-3 py-2 rounded-md",
            collapsed && "justify-center"
          )}>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={avatarUrl} alt={displayName} />
              <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-sidebar-foreground truncate">{user.email}</p>
              </div>
            )}
          </div>
        )}
        <div className="flex gap-1">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sidebar-foreground hover:bg-sidebar-accent text-sm transition-colors",
              collapsed ? "w-full" : "flex-1"
            )}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <><ChevronLeft className="w-4 h-4" /><span>Collapse</span></>}
          </button>
          {!collapsed && (
            <button
              onClick={signOut}
              className="flex items-center justify-center px-3 py-2 rounded-md text-sidebar-foreground hover:bg-destructive/20 hover:text-destructive text-sm transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}

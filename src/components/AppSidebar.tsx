import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, Truck, Warehouse,
  AlertTriangle, ChevronLeft, ChevronRight,
  ArrowRightLeft, Ship, RotateCcw, LogOut, Building2, ChevronsUpDown, Tag, User, Settings, Bot
} from "lucide-react";
import { useEffect, useState } from "react";

const CURRENT_AGENT_PHASE = "phase-1"; // bump when a new roadmap phase ships
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useCompany } from "@/contexts/CompanyContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";

export const navItems = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/orders", icon: Package, label: "Orders" },
  { to: "/exceptions", icon: AlertTriangle, label: "Exceptions" },
  { to: "/shipments", icon: Truck, label: "Shipments" },
  { to: "/returns", icon: RotateCcw, label: "Returns" },
  { to: "/supplier-manifests", icon: Ship, label: "Manufacturer Inbound" },
  { to: "/products", icon: Tag, label: "Products" },
  { to: "/inventory", icon: Warehouse, label: "Inventory" },
  { to: "/stock-movements", icon: ArrowRightLeft, label: "Stock Ledger" },
];

export const bottomNavItems = [
  { to: "/ai-agent", icon: Bot, label: "AI Agent", ping: true },
  { to: "/settings", icon: Settings, label: "Settings" },
];

/** Shared sidebar content used in both desktop sidebar and mobile drawer */
export function SidebarContent({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { companies, currentCompany, setCurrentCompany } = useCompany();

  const [profileData, setProfileData] = useState<{ display_name: string | null; job_title: string | null }>({
    display_name: null,
    job_title: null,
  });

  // Smart ping dot: animate → static → reset per phase
  const [agentDotState, setAgentDotState] = useState<'animate' | 'static'>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ai-agent-visits') || '{}');
      if (stored.phase !== CURRENT_AGENT_PHASE) return 'animate';
      if (stored.visited) return 'static';
      if ((stored.exposures || 0) >= 5) return 'static';
      return 'animate';
    } catch { return 'animate'; }
  });

  // Track exposures (any page load counts) & handle phase resets
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('ai-agent-visits') || '{}');
      // New phase → reset everything
      if (stored.phase !== CURRENT_AGENT_PHASE) {
        localStorage.setItem('ai-agent-visits', JSON.stringify({ phase: CURRENT_AGENT_PHASE, exposures: 1, visited: false }));
        setAgentDotState('animate');
        return;
      }
      if (stored.visited) return; // already visited, stay static
      const exposures = Math.min((stored.exposures || 0) + 1, 6);
      localStorage.setItem('ai-agent-visits', JSON.stringify({ ...stored, exposures }));
      if (exposures >= 5) setAgentDotState('static');
    } catch {}
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mark visited when navigating to /ai-agent
  useEffect(() => {
    if (location.pathname === '/ai-agent') {
      try {
        const stored = JSON.parse(localStorage.getItem('ai-agent-visits') || '{}');
        localStorage.setItem('ai-agent-visits', JSON.stringify({ ...stored, phase: CURRENT_AGENT_PHASE, visited: true }));
        setAgentDotState('static');
      } catch {}
    }
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, job_title")
        .eq("user_id", user.id)
        .single();
      if (data) setProfileData(data);
    };
    fetchProfile();
  }, [user]);

  const displayName = profileData.display_name || user?.user_metadata?.full_name || user?.email || "User";
  const jobTitle = profileData.job_title;
  const avatarUrl = user?.user_metadata?.avatar_url;
  const initials = displayName.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <>
      {/* Logo */}
      <div className="p-4 border-b border-sidebar-border flex items-center gap-3">
        <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center shrink-0">
          <Package className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold text-sidebar-accent-foreground truncate">FulfillMate</h1>
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
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
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

        {/* Separator */}
        <div className="my-2 mx-3 border-t border-sidebar-border" />

        {/* Bottom nav items (AI Agent, Settings) */}
        {bottomNavItems.map(({ to, icon: Icon, label, ping }) => {
          const isActive = location.pathname === to;
          return (
            <NavLink
              key={to}
              to={to}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors relative",
                isActive
                  ? "bg-sidebar-accent text-sidebar-primary"
                  : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="w-4 h-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
              {ping && (
                <span className={cn("flex h-2 w-2", collapsed ? "absolute top-1.5 right-1.5" : "ml-auto")}>
                  {agentDotState === 'animate' && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                  )}
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Profile Section */}
      <div className="p-2 border-t border-sidebar-border space-y-1">
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors hover:bg-sidebar-accent",
                collapsed && "justify-center"
              )}>
                <Avatar className="w-7 h-7 shrink-0">
                  <AvatarImage src={avatarUrl} alt={displayName} />
                  <AvatarFallback className="text-[10px] bg-sidebar-accent text-sidebar-accent-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {!collapsed && (
                  <div className="flex-1 overflow-hidden text-left">
                    <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
                    <p className="text-[10px] text-sidebar-foreground truncate">{jobTitle || user.email}</p>
                  </div>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="right" align="end" className="w-48">
              <DropdownMenuItem onClick={() => { navigate("/profile"); onNavigate?.(); }} className="cursor-pointer">
                <User className="w-3.5 h-3.5 mr-2" />
                View Profile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={signOut}
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut className="w-3.5 h-3.5 mr-2" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </>
  );
}

export default function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "hidden md:flex h-screen bg-sidebar border-r border-sidebar-border flex-col transition-all duration-200",
      collapsed ? "w-16" : "w-56"
    )}>
      <SidebarContent collapsed={collapsed} />
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

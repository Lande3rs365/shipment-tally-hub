import { ReactNode, useState, useCallback } from "react";
import { Menu, Package } from "lucide-react";
import AppSidebar, { SidebarContent } from "./AppSidebar";
import TawkWidget from "./TawkWidget";
import { useTawkSettings } from "@/hooks/useSupabaseData";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import PullToRefresh from "./PullToRefresh";
import MobileBottomTabs from "./MobileBottomTabs";
import { useQueryClient } from "@tanstack/react-query";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { data: tawkSettings } = useTawkSettings();
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    await queryClient.refetchQueries({ type: "active" });
  }, [queryClient]);

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <AppSidebar />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        {isMobile && (
          <header className="flex items-center gap-3 px-4 py-3 border-b border-border bg-sidebar shrink-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-1.5 rounded-md hover:bg-sidebar-accent text-sidebar-foreground"
              aria-label="Open menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-md bg-primary flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
              <span className="text-sm font-bold text-sidebar-accent-foreground">FulfillMate</span>
            </div>
          </header>
        )}

        {/* Mobile drawer */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar border-sidebar-border">
            <VisuallyHidden>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden>
            <div className="flex flex-col h-full">
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </div>
          </SheetContent>
        </Sheet>

        <PullToRefresh onRefresh={handleRefresh}>
          {children}
        </PullToRefresh>

        {isMobile && <MobileBottomTabs />}
      </div>

      {tawkSettings?.is_enabled && tawkSettings?.property_id && (
        <TawkWidget
          propertyId={tawkSettings.property_id}
          widgetId={tawkSettings.widget_id}
        />
      )}
    </div>
  );
}

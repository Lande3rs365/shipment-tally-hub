import { ReactNode } from "react";
import AppSidebar from "./AppSidebar";
import TawkWidget from "./TawkWidget";
import { useTawkSettings } from "@/hooks/useSupabaseData";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { data: tawkSettings } = useTawkSettings();

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
      {tawkSettings?.is_enabled && tawkSettings?.property_id && (
        <TawkWidget
          propertyId={tawkSettings.property_id}
          widgetId={tawkSettings.widget_id}
        />
      )}
    </div>
  );
}

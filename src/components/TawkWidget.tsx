import { useEffect } from "react";

interface TawkWidgetProps {
  propertyId: string;
  widgetId?: string;
}

export default function TawkWidget({ propertyId, widgetId = "default" }: TawkWidgetProps) {
  useEffect(() => {
    if (!propertyId) return;

    // Don't load twice
    if (document.getElementById("tawk-script")) return;

    const script = document.createElement("script");
    script.id = "tawk-script";
    script.async = true;
    script.src = `https://embed.tawk.to/${propertyId}/${widgetId}`;
    script.charset = "UTF-8";
    script.setAttribute("crossorigin", "*");
    document.head.appendChild(script);

    return () => {
      const existing = document.getElementById("tawk-script");
      if (existing) existing.remove();
      // Clean up Tawk global
      if ((window as any).Tawk_API) {
        delete (window as any).Tawk_API;
      }
    };
  }, [propertyId, widgetId]);

  return null;
}

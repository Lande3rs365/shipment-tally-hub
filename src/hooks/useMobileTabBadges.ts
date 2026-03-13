import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";

interface TabBadges {
  exceptions: number;
  processing: number;
  lowStock: number;
}

export function useMobileTabBadges(): TabBadges {
  const { currentCompany } = useCompany();

  const { data } = useQuery<TabBadges>({
    queryKey: ["mobile_tab_badges", currentCompany?.id],
    queryFn: async () => {
      const cid = currentCompany!.id;

      const [exceptions, processing, inventory] = await Promise.all([
        supabase
          .from("exceptions")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("status", "open"),
        supabase
          .from("orders")
          .select("id", { count: "exact", head: true })
          .eq("company_id", cid)
          .eq("status", "processing"),
        supabase
          .from("inventory")
          .select("on_hand, products!inner(reorder_point)")
          .eq("company_id", cid),
      ]);

      const lowStock = (inventory.data || []).filter(
        (i: any) => i.on_hand <= (i.products?.reorder_point || 0)
      ).length;

      return {
        exceptions: exceptions.count || 0,
        processing: processing.count || 0,
        lowStock,
      };
    },
    enabled: !!currentCompany?.id,
    refetchInterval: 60_000,
  });

  return data || { exceptions: 0, processing: 0, lowStock: 0 };
}

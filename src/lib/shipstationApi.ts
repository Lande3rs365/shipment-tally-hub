import { supabase } from "@/integrations/supabase/client";

async function callShipStationProxy(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("shipstation-proxy", {
    body,
  });
  if (error) throw new Error(error.message || "ShipStation proxy error");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function testShipStationConnection(companyId: string) {
  return callShipStationProxy({ company_id: companyId, action: "test" });
}

export async function fetchShipStationOrders(
  companyId: string,
  since?: string,
  onProgress?: (fetched: number, total: number) => void,
) {
  const allOrders: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    const result = await callShipStationProxy({
      company_id: companyId,
      action: "fetch_orders",
      page,
      page_size: 100,
      since,
    });

    allOrders.push(...(result.orders || []));
    totalPages = result.pages || 1;
    onProgress?.(allOrders.length, result.total || allOrders.length);
    page++;
  }

  return allOrders;
}

export async function fetchShipStationShipments(
  companyId: string,
  since?: string,
  onProgress?: (fetched: number, total: number) => void,
) {
  const allShipments: any[] = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages && page <= 50) {
    const result = await callShipStationProxy({
      company_id: companyId,
      action: "fetch_shipments",
      page,
      page_size: 100,
      since,
    });

    allShipments.push(...(result.shipments || []));
    totalPages = result.pages || 1;
    onProgress?.(allShipments.length, result.total || allShipments.length);
    page++;
  }

  return allShipments;
}

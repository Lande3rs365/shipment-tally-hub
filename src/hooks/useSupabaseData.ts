import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import type {
  Order, OrderItem, OrderWithItems, Shipment, ShipmentWithOrder,
  InventoryWithRelations, StockMovement, StockMovementWithRelations,
  ManifestWithItems, Return, Exception, DataIntakeLog, Product,
  OrderEvent, StockLocation,
} from "@/types/database";

const db = supabase as any;

function useCompanyQuery<T>(
  key: string,
  queryFn: (companyId: string) => Promise<T>,
  options?: { enabled?: boolean }
) {
  const { currentCompany } = useCompany();
  return useQuery<T>({
    queryKey: [key, currentCompany?.id],
    queryFn: () => queryFn(currentCompany!.id),
    enabled: !!currentCompany?.id && (options?.enabled !== false),
  });
}

// ── Orders ──
export function useOrders() {
  return useCompanyQuery<OrderWithItems[]>("orders", async (companyId) => {
    // Fetch all orders in pages to avoid the 1000-row PostgREST limit
    const PAGE_SIZE = 1000;
    let allData: any[] = [];
    let page = 0;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await db
        .from('orders')
        .select('*, order_items(*)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (error) throw error;
      allData = allData.concat(data || []);
      hasMore = (data || []).length === PAGE_SIZE;
      page++;
    }
    return allData;
  });
}

export function useOrder(orderId: string | undefined) {
  const { currentCompany } = useCompany();
  return useQuery<OrderWithItems | null>({
    queryKey: ["order", orderId, currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('orders')
        .select('*, order_items(*)')
        .eq('company_id', currentCompany!.id)
        .eq('order_number', orderId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!currentCompany?.id && !!orderId,
  });
}

export function useOrderEvents(orderId: string | undefined) {
  return useQuery<OrderEvent[]>({
    queryKey: ["order_events", orderId],
    queryFn: async () => {
      const { data, error } = await db
        .from('order_events')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });
}

// ── Order Shipments ──
export function useOrderShipments(orderId: string | undefined) {
  return useQuery<Shipment[]>({
    queryKey: ["order_shipments", orderId],
    queryFn: async () => {
      const { data, error } = await db
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!orderId,
  });
}

// ── Inventory ──
export function useInventory() {
  return useCompanyQuery<InventoryWithRelations[]>("inventory", async (companyId) => {
    const { data, error } = await db
      .from('inventory')
      .select('*, products(sku, name, reorder_point), stock_locations(name, code)')
      .eq('company_id', companyId);
    if (error) throw error;
    return data || [];
  });
}

// ── Stock Movements ──
export function useStockMovements() {
  return useCompanyQuery<StockMovement[]>("stock_movements", async (companyId) => {
    const { data, error } = await db
      .from('stock_movements')
      .select('*, products:product_id(name)')
      .eq('company_id', companyId)
      .order('timestamp', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

export function useStockMovementsByProduct(productId: string | undefined) {
  const { currentCompany } = useCompany();
  return useQuery<StockMovement[]>({
    queryKey: ["stock_movements_product", productId, currentCompany?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from('stock_movements')
        .select('*')
        .eq('company_id', currentCompany!.id)
        .eq('product_id', productId)
        .order('timestamp', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentCompany?.id && !!productId,
  });
}

// ── Shipments ──
export function useShipments() {
  return useCompanyQuery<ShipmentWithOrder[]>("shipments", async (companyId) => {
    const { data, error } = await db
      .from('shipments')
      .select('*, orders(order_number, customer_name)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

// ── Returns ──
export function useReturns() {
  return useCompanyQuery<(Return & { orders: Pick<Order, 'order_number'> | null })[]>(
    "returns",
    async (companyId) => {
      const { data, error } = await db
        .from('returns')
        .select('*, orders(order_number)')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    }
  );
}

// ── Manufacturer Manifests ──
export function useManufacturerManifests() {
  return useCompanyQuery<ManifestWithItems[]>("manufacturer_manifests", async (companyId) => {
    const { data, error } = await db
      .from('manufacturer_manifests')
      .select('*, manufacturer_manifest_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

// ── Exceptions ──
export function useExceptions() {
  return useCompanyQuery<(Exception & { orders: Pick<Order, 'order_number' | 'customer_name' | 'woo_status' | 'order_date'> | null })[]>("exceptions", async (companyId) => {
    const { data, error } = await db
      .from('exceptions')
      .select('*, orders:linked_order_id(order_number, customer_name, woo_status, order_date)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

// ── Products ──
export function useProducts() {
  return useCompanyQuery<Product[]>("products", async (companyId) => {
    const { data, error } = await db
      .from('products')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('sku');
    if (error) throw error;
    return data || [];
  });
}

// ── Locations ──
export function useStockLocations() {
  return useCompanyQuery<StockLocation[]>("stock_locations", async (companyId) => {
    const { data, error } = await db
      .from('stock_locations')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');
    if (error) throw error;
    return data || [];
  });
}

// ── Data Intake Logs ──
export function useDataIntakeLogs() {
  return useCompanyQuery<DataIntakeLog[]>("data_intake_logs", async (companyId) => {
    const { data, error } = await db
      .from('data_intake_logs')
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

// ── Import SKU Framework XLSX ──
export function useImportSkuFramework() {
  const { currentCompany } = useCompany();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ArrayBuffer) => {
      const { parseSkuFrameworkXlsx, resolveParentSku } = await import("@/lib/skuFrameworkParser");
      const companyId = currentCompany!.id;
      const parsed = parseSkuFrameworkXlsx(data);
      if (parsed.length === 0) throw new Error("No products found in the spreadsheet.");

      // Get existing SKUs
      const { data: existing, error: pErr } = await db
        .from('products').select('sku, id').eq('company_id', companyId);
      if (pErr) throw pErr;
      const existingMap = new Map((existing || []).map((p: any) => [p.sku, p.id]));

      const parents = parsed.filter(p => p.row_type === 'parent' || p.row_type === 'standalone');
      const variants = parsed.filter(p => p.row_type === 'variant');
      let created = 0;
      let skipped = 0;

      // Pass 1: Insert parents/standalones
      const BATCH = 100;
      const newParents = parents.filter(p => !existingMap.has(p.sku));
      skipped += parents.length - newParents.length;
      for (let i = 0; i < newParents.length; i += BATCH) {
        const batch = newParents.slice(i, i + BATCH).map(p => ({
          company_id: companyId, sku: p.sku, name: p.name,
          category: p.category, row_type: p.row_type, description: p.description,
        }));
        const { data: inserted, error } = await db.from('products').insert(batch).select('sku, id');
        if (error) throw error;
        for (const row of (inserted || [])) existingMap.set(row.sku, row.id);
        created += batch.length;
      }

      // Pass 2: Insert variants with parent_product_id
      const newVariants = variants.filter(v => !existingMap.has(v.sku));
      skipped += variants.length - newVariants.length;
      const knownSkus = new Set<string>(existingMap.keys() as Iterable<string>);
      for (let i = 0; i < newVariants.length; i += BATCH) {
        const batch = newVariants.slice(i, i + BATCH).map(v => {
          const parentSku = resolveParentSku(v.sku, knownSkus);
          const parentId = parentSku ? existingMap.get(parentSku) || null : null;
          return {
            company_id: companyId, sku: v.sku, name: v.name,
            category: v.category, row_type: v.row_type, description: v.description,
            parent_product_id: parentId,
          };
        });
        const { data: inserted, error } = await db.from('products').insert(batch).select('sku, id');
        if (error) throw error;
        for (const row of (inserted || [])) existingMap.set(row.sku, row.id);
        created += batch.length;
      }

      return { created, skipped };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
    },
  });
}

// ── Dashboard aggregates ──
export function useDashboardStats() {
  const { currentCompany } = useCompany();
  return useQuery({
    queryKey: ["dashboard_stats", currentCompany?.id],
    queryFn: async () => {
      const cid = currentCompany!.id;

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayISO = todayStart.toISOString();

      const [orders, shipments, products, inventory, exceptions, movements, manifests, todayProcessing, todayShipments, oldestExceptions, shippingAlerts] = await Promise.all([
        db.from('orders').select('id, status, order_date, created_at').eq('company_id', cid),
        db.from('shipments').select('id, status, shipped_date, created_at').eq('company_id', cid),
        db.from('returns').select('id', { count: 'exact' }).eq('company_id', cid).in('status', ['initiated', 'received']),
        db.from('inventory').select('*, products(sku, name, reorder_point)').eq('company_id', cid),
        db.from('exceptions').select('*').eq('company_id', cid).eq('status', 'open'),
        db.from('stock_movements').select('*').eq('company_id', cid).order('timestamp', { ascending: false }).limit(20),
        db.from('manufacturer_manifests').select('*, manufacturer_manifest_items(*)').eq('company_id', cid).in('status', ['pending', 'shipped', 'in_transit']).order('eta', { ascending: true }),
        // All processing orders
        db.from('orders').select('id, order_number, customer_name, order_date, status, woo_status, total_amount').eq('company_id', cid).eq('status', 'processing').order('order_date', { ascending: false }),
        // Today's shipments (by shipped_date, not created_at — avoids inflating count on import days)
        db.from('shipments').select('id').eq('company_id', cid).gte('shipped_date', todayISO),
        // Oldest open exceptions with linked order info
        db.from('exceptions').select('*, orders:linked_order_id(order_number, customer_name, order_date)').eq('company_id', cid).eq('status', 'open').order('created_at', { ascending: true }).limit(50),
        // Shipping urgent alerts — shipments with problematic carrier statuses
        db.from('shipments').select('*, orders:order_id(order_number, customer_name, order_date)').eq('company_id', cid).not('status', 'in', '("delivered","in_transit","label_created")').order('shipped_date', { ascending: true }).limit(50),
      ]);

      const orderList = orders.data || [];
      const shipmentList = shipments.data || [];
      const inventoryList = (inventory.data || []) as InventoryWithRelations[];
      const exceptionList = (exceptions.data || []) as Exception[];
      const movementList = (movements.data || []) as StockMovement[];
      const manifestList = (manifests.data || []) as ManifestWithItems[];

      const totalOnHand = inventoryList.reduce((s, i) => s + i.on_hand, 0);
      const shipped = orderList.filter((o: any) => ['shipped', 'delivered', 'completed'].includes(o.status)).length;

      // Top 5 most urgent stock alerts (lowest on_hand relative to reorder_point)
      const alerts = inventoryList
        .filter(i => {
          const threshold = i.products?.reorder_point || 0;
          return i.on_hand <= threshold;
        })
        .sort((a, b) => {
          const aRatio = a.on_hand / Math.max(a.products?.reorder_point || 1, 1);
          const bRatio = b.on_hand / Math.max(b.products?.reorder_point || 1, 1);
          return aRatio - bRatio;
        })
        .slice(0, 5);

      return {
        totalOrders: orderList.length,
        ordersShipped: shipped,
        shipmentsToday: (todayShipments.data || []).length,
        exceptions: exceptionList.length,
        returnsPending: products.count || 0,
        stockOnHand: totalOnHand,
        inventoryAlerts: alerts,
        oldestExceptions: oldestExceptions.data || [],
        recentMovements: movementList,
        manifests: manifestList,
        todayProcessing: todayProcessing.data || [],
        shippingAlerts: shippingAlerts.data || [],
        allOrders: orderList,
        allShipments: shipmentList,
      };
    },
    enabled: !!currentCompany?.id,
  });
}

// ── Purchased Add-ons ──
export interface PurchasedAddon {
  id: string;
  company_id: string;
  addon_type: string;
  quantity: number;
  stripe_payment_id: string | null;
  purchased_by: string;
  created_at: string;
}

export function usePurchasedAddons() {
  return useCompanyQuery<PurchasedAddon[]>("purchased_addons", async (companyId) => {
    const { data, error } = await db
      .from("purchased_addons")
      .select("*")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  });
}

export function useExtraSeats() {
  const { data: addons = [] } = usePurchasedAddons();
  return addons
    .filter((a: PurchasedAddon) => a.addon_type === "extra_seat")
    .reduce((sum: number, a: PurchasedAddon) => sum + a.quantity, 0);
}

export function useHasAddon(addonType: string) {
  const { data: addons = [] } = usePurchasedAddons();
  return addons.some((a: PurchasedAddon) => a.addon_type === addonType);
}

import { useQuery } from "@tanstack/react-query";
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
    const { data, error } = await db
      .from('orders')
      .select('*, order_items(*)')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
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
  return useCompanyQuery<Exception[]>("exceptions", async (companyId) => {
    const { data, error } = await db
      .from('exceptions')
      .select('*')
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

// ── Dashboard aggregates ──
export function useDashboardStats() {
  const { currentCompany } = useCompany();
  return useQuery({
    queryKey: ["dashboard_stats", currentCompany?.id],
    queryFn: async () => {
      const cid = currentCompany!.id;

      const [orders, shipments, products, inventory, exceptions, movements, manifests, recentOrders] = await Promise.all([
        db.from('orders').select('id, status, order_date, created_at').eq('company_id', cid),
        db.from('shipments').select('id, status, shipped_date, created_at').eq('company_id', cid),
        db.from('products').select('id', { count: 'exact' }).eq('company_id', cid).eq('is_active', true),
        db.from('inventory').select('*, products(sku, name, reorder_point)').eq('company_id', cid),
        db.from('exceptions').select('*').eq('company_id', cid).eq('status', 'open'),
        db.from('stock_movements').select('*').eq('company_id', cid).order('timestamp', { ascending: false }).limit(20),
        db.from('manufacturer_manifests').select('*, manufacturer_manifest_items(*)').eq('company_id', cid),
        db.from('orders').select('id, order_number, customer_name, order_date, status, woo_status').eq('company_id', cid).order('created_at', { ascending: false }).limit(5),
      ]);

      const orderList = orders.data || [];
      const shipmentList = shipments.data || [];
      const inventoryList = (inventory.data || []) as InventoryWithRelations[];
      const exceptionList = (exceptions.data || []) as Exception[];
      const movementList = (movements.data || []) as StockMovement[];
      const manifestList = (manifests.data || []) as ManifestWithItems[];

      const totalOnHand = inventoryList.reduce((s, i) => s + i.on_hand, 0);
      const shipped = orderList.filter((o: any) => ['shipped', 'delivered'].includes(o.status)).length;
      const awaiting = orderList.filter((o: any) => ['pending', 'processing'].includes(o.status)).length;

      const alerts = inventoryList.filter(i => {
        const threshold = i.products?.reorder_point || 0;
        return i.on_hand <= threshold;
      });

      return {
        totalOrders: orderList.length,
        ordersShipped: shipped,
        awaitingShipment: awaiting,
        exceptions: exceptionList.length,
        totalSKUs: products.count || 0,
        stockOnHand: totalOnHand,
        inventoryAlerts: alerts,
        activeExceptions: exceptionList,
        recentMovements: movementList,
        manifests: manifestList,
        recentOrders: recentOrders.data || [],
        allOrders: orderList,
        allShipments: shipmentList,
      };
    },
    enabled: !!currentCompany?.id,
  });
}

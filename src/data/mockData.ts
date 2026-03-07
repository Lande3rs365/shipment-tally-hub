// Mock data for the demo

export interface MasterOrder {
  id: string;
  orderId: string;
  orderDate: string;
  customerName: string;
  customerEmail: string;
  companyId: string;
  items: OrderItem[];
  wooStatus: 'processing' | 'completed' | 'on-hold' | 'cancelled' | 'refunded';
  shipmentCarrier: string | null;
  trackingNumber: string | null;
  shipmentDate: string | null;
  shipmentStatus: 'not-shipped' | 'label-created' | 'in-transit' | 'delivered' | 'returned';
  inventoryStatus: 'in-stock' | 'reserved' | 'allocated' | 'out-of-stock' | 'backordered';
  operationalStatus: 'awaiting-stock' | 'packing' | 'ready-to-ship' | 'shipped' | 'delivered' | 'exception';
  supportStatus: string;
  exceptionFlag: boolean;
  exceptionReason?: string;
  sourceFile: string;
  lastUpdated: string;
  notes: string[];
}

export interface OrderItem {
  sku: string;
  name: string;
  quantity: number;
}

export type InventoryStatusType =
  | 'in-stock' | 'low-stock' | 'out-of-stock' | 'reserved'
  | 'allocated' | 'backordered' | 'awaiting-replenishment'
  | 'damaged' | 'defective' | 'in-quarantine' | 'on-hold';

export interface InventoryItem {
  sku: string;
  productName: string;
  category: string;
  stockOnHand: number;
  availableStock: number;
  reservedStock: number;
  allocatedStock: number;
  shippedQuantity: number;
  returnedQuantity: number;
  damagedStock: number;
  defectiveStock: number;
  quarantineStock: number;
  incomingStock: number;
  reorderThreshold: number;
  status: InventoryStatusType;
  lastUpdated: string;
  warehouseLocation: string;
}

export type MovementDirection = 'IN' | 'OUT' | 'MOVE' | 'ADJUST';

export type MovementType =
  | 'ORDER_RESERVED' | 'ORDER_CANCELLED_RELEASE'
  | 'STOCK_ALLOCATED_TO_SHIPMENT' | 'SHIPMENT_CONFIRMED'
  | 'RETURN_RESTOCKED' | 'RETURN_DEFECTIVE' | 'RETURN_QUARANTINE'
  | 'STOCK_MARKED_DEFECTIVE' | 'STOCK_MARKED_DAMAGED' | 'STOCK_WRITTEN_OFF'
  | 'STOCK_RESTORED_FROM_HOLD'
  | 'MANUAL_RESTOCK' | 'MANUAL_CORRECTION_UP' | 'MANUAL_CORRECTION_DOWN'
  | 'SUPPLIER_REPLENISHMENT' | 'WAREHOUSE_TRANSFER'
  | 'SAMPLE_USE' | 'INTERNAL_USE' | 'REPLACEMENT_SENT' | 'LOST_MISSING';

export interface InventoryMovement {
  movementId: string;
  timestamp: string;
  sku: string;
  productName: string;
  quantity: number;
  direction: MovementDirection;
  movementType: MovementType;
  reasonCode: string;
  sourceType: string;
  sourceReference: string;
  linkedOrderId: string | null;
  linkedShipmentId: string | null;
  userId: string;
  notes: string;
  warehouseLocation: string;
  statusBefore: InventoryStatusType;
  statusAfter: InventoryStatusType;
}

export interface ExceptionRecord {
  id: string;
  orderId: string;
  type: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  detectedAt: string;
  resolved: boolean;
}

// ── Orders ──
export const mockOrders: MasterOrder[] = [
  {
    id: '1', orderId: 'WOO-10421', orderDate: '2026-03-01', customerName: 'Sarah Mitchell',
    customerEmail: 'sarah.m@email.com', items: [{ sku: 'VIT-C-500', name: 'Vitamin C 500mg', quantity: 2 }],
    wooStatus: 'processing', shipmentCarrier: 'USPS', trackingNumber: '9400111899223456789012',
    shipmentDate: '2026-03-02', shipmentStatus: 'in-transit', inventoryStatus: 'allocated',
    operationalStatus: 'shipped', supportStatus: 'Shipment in transit via USPS',
    exceptionFlag: false, sourceFile: 'woo_export_mar01.csv', lastUpdated: '2026-03-02T14:30:00Z', notes: []
  },
  {
    id: '2', orderId: 'WOO-10422', orderDate: '2026-03-01', customerName: 'James Porter',
    customerEmail: 'jporter@email.com', items: [{ sku: 'OMEGA-3-120', name: 'Omega 3 Fish Oil 120ct', quantity: 1 }, { sku: 'ZNC-50', name: 'Zinc 50mg', quantity: 3 }],
    wooStatus: 'processing', shipmentCarrier: null, trackingNumber: null,
    shipmentDate: null, shipmentStatus: 'not-shipped', inventoryStatus: 'out-of-stock',
    operationalStatus: 'awaiting-stock', supportStatus: 'Delayed — awaiting stock allocation',
    exceptionFlag: true, exceptionReason: 'OMEGA-3-120 out of stock', sourceFile: 'woo_export_mar01.csv', lastUpdated: '2026-03-03T09:00:00Z', notes: ['Vendor ETA: March 8']
  },
  {
    id: '3', orderId: 'WOO-10423', orderDate: '2026-03-02', customerName: 'Linda Chen',
    customerEmail: 'lchen@email.com', items: [{ sku: 'MAG-400', name: 'Magnesium 400mg', quantity: 1 }],
    wooStatus: 'completed', shipmentCarrier: 'UPS', trackingNumber: '1Z999AA10123456784',
    shipmentDate: '2026-03-03', shipmentStatus: 'delivered', inventoryStatus: 'allocated',
    operationalStatus: 'delivered', supportStatus: 'Delivered',
    exceptionFlag: false, sourceFile: 'woo_export_mar02.csv', lastUpdated: '2026-03-04T11:00:00Z', notes: []
  },
  {
    id: '4', orderId: 'WOO-10424', orderDate: '2026-03-02', customerName: 'Marcus Brown',
    customerEmail: 'mbrown@email.com', items: [{ sku: 'VIT-D-1000', name: 'Vitamin D3 1000IU', quantity: 2 }],
    wooStatus: 'completed', shipmentCarrier: null, trackingNumber: null,
    shipmentDate: null, shipmentStatus: 'not-shipped', inventoryStatus: 'in-stock',
    operationalStatus: 'exception', supportStatus: 'Under review — marked complete but not shipped',
    exceptionFlag: true, exceptionReason: 'Completed in Woo but no shipment record', sourceFile: 'woo_export_mar02.csv', lastUpdated: '2026-03-04T08:00:00Z', notes: []
  },
  {
    id: '5', orderId: 'WOO-10425', orderDate: '2026-03-03', customerName: 'Amy Rodriguez',
    customerEmail: 'amy.r@email.com', items: [{ sku: 'PROB-60', name: 'Probiotic 60 Billion CFU', quantity: 1 }],
    wooStatus: 'processing', shipmentCarrier: 'USPS', trackingNumber: null,
    shipmentDate: null, shipmentStatus: 'label-created', inventoryStatus: 'reserved',
    operationalStatus: 'packing', supportStatus: 'Preparing shipment',
    exceptionFlag: false, sourceFile: 'woo_export_mar03.csv', lastUpdated: '2026-03-04T10:00:00Z', notes: []
  },
  {
    id: '6', orderId: 'WOO-10426', orderDate: '2026-03-03', customerName: 'David Kim',
    customerEmail: 'dkim@email.com', items: [{ sku: 'VIT-C-500', name: 'Vitamin C 500mg', quantity: 5 }],
    wooStatus: 'on-hold', shipmentCarrier: null, trackingNumber: null,
    shipmentDate: null, shipmentStatus: 'not-shipped', inventoryStatus: 'in-stock',
    operationalStatus: 'awaiting-stock', supportStatus: 'On hold — pending payment confirmation',
    exceptionFlag: false, sourceFile: 'woo_export_mar03.csv', lastUpdated: '2026-03-04T07:00:00Z', notes: []
  },
  {
    id: '7', orderId: 'WOO-10427', orderDate: '2026-03-04', customerName: 'Rachel Green',
    customerEmail: 'rgreen@email.com', items: [{ sku: 'IRON-65', name: 'Iron 65mg', quantity: 2 }, { sku: 'VIT-B12-1000', name: 'Vitamin B12 1000mcg', quantity: 1 }],
    wooStatus: 'processing', shipmentCarrier: 'FedEx', trackingNumber: '794644790132',
    shipmentDate: '2026-03-05', shipmentStatus: 'in-transit', inventoryStatus: 'allocated',
    operationalStatus: 'shipped', supportStatus: 'Shipped via FedEx',
    exceptionFlag: false, sourceFile: 'woo_export_mar04.csv', lastUpdated: '2026-03-05T16:00:00Z', notes: []
  },
  {
    id: '8', orderId: 'WOO-10428', orderDate: '2026-03-04', customerName: 'Tom Wallace',
    customerEmail: 'twallace@email.com', items: [{ sku: 'OMEGA-3-120', name: 'Omega 3 Fish Oil 120ct', quantity: 2 }],
    wooStatus: 'processing', shipmentCarrier: null, trackingNumber: null,
    shipmentDate: null, shipmentStatus: 'not-shipped', inventoryStatus: 'backordered',
    operationalStatus: 'awaiting-stock', supportStatus: 'Backordered — estimated restock March 8',
    exceptionFlag: true, exceptionReason: 'SKU backordered, no restock ETA confirmed', sourceFile: 'woo_export_mar04.csv', lastUpdated: '2026-03-05T09:00:00Z', notes: []
  },
];

// ── Inventory (enhanced with movement-based quantities) ──
export const mockInventory: InventoryItem[] = [
  { sku: 'VIT-C-500', productName: 'Vitamin C 500mg', category: 'Vitamins', stockOnHand: 342, availableStock: 335, reservedStock: 7, allocatedStock: 0, shippedQuantity: 124, returnedQuantity: 3, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 500, reorderThreshold: 100, status: 'in-stock', lastUpdated: '2026-03-05', warehouseLocation: 'A-12' },
  { sku: 'OMEGA-3-120', productName: 'Omega 3 Fish Oil 120ct', category: 'Supplements', stockOnHand: 0, availableStock: 0, reservedStock: 0, allocatedStock: 0, shippedQuantity: 86, returnedQuantity: 1, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 200, reorderThreshold: 50, status: 'out-of-stock', lastUpdated: '2026-03-05', warehouseLocation: 'B-03' },
  { sku: 'ZNC-50', productName: 'Zinc 50mg', category: 'Minerals', stockOnHand: 89, availableStock: 86, reservedStock: 3, allocatedStock: 0, shippedQuantity: 47, returnedQuantity: 0, damagedStock: 2, defectiveStock: 0, quarantineStock: 0, incomingStock: 0, reorderThreshold: 75, status: 'low-stock', lastUpdated: '2026-03-05', warehouseLocation: 'A-08' },
  { sku: 'MAG-400', productName: 'Magnesium 400mg', category: 'Minerals', stockOnHand: 210, availableStock: 210, reservedStock: 0, allocatedStock: 0, shippedQuantity: 62, returnedQuantity: 2, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 0, reorderThreshold: 50, status: 'in-stock', lastUpdated: '2026-03-04', warehouseLocation: 'A-15' },
  { sku: 'VIT-D-1000', productName: 'Vitamin D3 1000IU', category: 'Vitamins', stockOnHand: 445, availableStock: 445, reservedStock: 0, allocatedStock: 0, shippedQuantity: 98, returnedQuantity: 0, damagedStock: 0, defectiveStock: 5, quarantineStock: 0, incomingStock: 0, reorderThreshold: 100, status: 'in-stock', lastUpdated: '2026-03-05', warehouseLocation: 'A-03' },
  { sku: 'PROB-60', productName: 'Probiotic 60 Billion CFU', category: 'Probiotics', stockOnHand: 67, availableStock: 66, reservedStock: 1, allocatedStock: 0, shippedQuantity: 33, returnedQuantity: 0, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 150, reorderThreshold: 40, status: 'in-stock', lastUpdated: '2026-03-05', warehouseLocation: 'C-01' },
  { sku: 'IRON-65', productName: 'Iron 65mg', category: 'Minerals', stockOnHand: 28, availableStock: 26, reservedStock: 2, allocatedStock: 0, shippedQuantity: 19, returnedQuantity: 1, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 0, reorderThreshold: 30, status: 'low-stock', lastUpdated: '2026-03-05', warehouseLocation: 'B-07' },
  { sku: 'VIT-B12-1000', productName: 'Vitamin B12 1000mcg', category: 'Vitamins', stockOnHand: 156, availableStock: 155, reservedStock: 1, allocatedStock: 0, shippedQuantity: 44, returnedQuantity: 0, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 0, reorderThreshold: 50, status: 'in-stock', lastUpdated: '2026-03-04', warehouseLocation: 'A-06' },
  { sku: 'COLG-TYPE2', productName: 'Collagen Type II', category: 'Supplements', stockOnHand: 12, availableStock: 12, reservedStock: 0, allocatedStock: 0, shippedQuantity: 8, returnedQuantity: 0, damagedStock: 0, defectiveStock: 0, quarantineStock: 3, incomingStock: 100, reorderThreshold: 25, status: 'low-stock', lastUpdated: '2026-03-03', warehouseLocation: 'C-04' },
  { sku: 'TURM-500', productName: 'Turmeric Curcumin 500mg', category: 'Supplements', stockOnHand: 0, availableStock: 0, reservedStock: 0, allocatedStock: 0, shippedQuantity: 41, returnedQuantity: 2, damagedStock: 0, defectiveStock: 0, quarantineStock: 0, incomingStock: 0, reorderThreshold: 60, status: 'out-of-stock', lastUpdated: '2026-03-01', warehouseLocation: 'B-11' },
];

// ── Inventory Movements (stock ledger) ──
export const mockMovements: InventoryMovement[] = [
  { movementId: 'MOV-001', timestamp: '2026-03-01T08:15:00Z', sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantity: 2, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10421', linkedOrderId: 'WOO-10421', linkedShipmentId: null, userId: 'ops-user-1', notes: 'Auto-reserved from order import', warehouseLocation: 'A-12', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-002', timestamp: '2026-03-01T08:16:00Z', sku: 'OMEGA-3-120', productName: 'Omega 3 Fish Oil 120ct', quantity: 1, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10422', linkedOrderId: 'WOO-10422', linkedShipmentId: null, userId: 'ops-user-1', notes: 'Failed — insufficient stock', warehouseLocation: 'B-03', statusBefore: 'out-of-stock', statusAfter: 'out-of-stock' },
  { movementId: 'MOV-003', timestamp: '2026-03-02T10:30:00Z', sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantity: 2, direction: 'OUT', movementType: 'STOCK_ALLOCATED_TO_SHIPMENT', reasonCode: 'Shipment preparation', sourceType: 'Pirate Ship', sourceReference: 'PS-88421', linkedOrderId: 'WOO-10421', linkedShipmentId: 'PS-88421', userId: 'warehouse-1', notes: 'Label created USPS', warehouseLocation: 'A-12', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-004', timestamp: '2026-03-02T14:30:00Z', sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantity: 2, direction: 'OUT', movementType: 'SHIPMENT_CONFIRMED', reasonCode: 'Shipment dispatched', sourceType: 'Pirate Ship', sourceReference: 'PS-88421', linkedOrderId: 'WOO-10421', linkedShipmentId: 'PS-88421', userId: 'warehouse-1', notes: 'Tracking: 9400111899223456789012', warehouseLocation: 'A-12', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-005', timestamp: '2026-03-03T09:00:00Z', sku: 'MAG-400', productName: 'Magnesium 400mg', quantity: 1, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10423', linkedOrderId: 'WOO-10423', linkedShipmentId: null, userId: 'ops-user-1', notes: '', warehouseLocation: 'A-15', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-006', timestamp: '2026-03-03T11:00:00Z', sku: 'MAG-400', productName: 'Magnesium 400mg', quantity: 1, direction: 'OUT', movementType: 'SHIPMENT_CONFIRMED', reasonCode: 'Shipment dispatched', sourceType: 'UPS', sourceReference: '1Z999AA10123456784', linkedOrderId: 'WOO-10423', linkedShipmentId: 'UPS-10423', userId: 'warehouse-1', notes: 'Delivered', warehouseLocation: 'A-15', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-007', timestamp: '2026-03-04T07:30:00Z', sku: 'VIT-D-1000', productName: 'Vitamin D3 1000IU', quantity: 5, direction: 'ADJUST', movementType: 'STOCK_MARKED_DEFECTIVE', reasonCode: 'Quality inspection failure', sourceType: 'Manual', sourceReference: 'QC-Report-0304', linkedOrderId: null, linkedShipmentId: null, userId: 'inv-mgr-1', notes: 'Batch 2026-02 failed QC test', warehouseLocation: 'A-03', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-008', timestamp: '2026-03-04T09:00:00Z', sku: 'ZNC-50', productName: 'Zinc 50mg', quantity: 2, direction: 'ADJUST', movementType: 'STOCK_MARKED_DAMAGED', reasonCode: 'Warehouse damage', sourceType: 'Manual', sourceReference: 'DMG-0304-01', linkedOrderId: null, linkedShipmentId: null, userId: 'warehouse-1', notes: 'Dropped during restock', warehouseLocation: 'A-08', statusBefore: 'in-stock', statusAfter: 'low-stock' },
  { movementId: 'MOV-009', timestamp: '2026-03-04T10:00:00Z', sku: 'PROB-60', productName: 'Probiotic 60 Billion CFU', quantity: 1, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10425', linkedOrderId: 'WOO-10425', linkedShipmentId: null, userId: 'ops-user-1', notes: '', warehouseLocation: 'C-01', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-010', timestamp: '2026-03-04T14:00:00Z', sku: 'COLG-TYPE2', productName: 'Collagen Type II', quantity: 3, direction: 'MOVE', movementType: 'RETURN_QUARANTINE', reasonCode: 'Return inspection required', sourceType: 'Returns', sourceReference: 'RET-0304-01', linkedOrderId: 'WOO-10390', linkedShipmentId: null, userId: 'warehouse-1', notes: 'Customer return — packaging damaged, product condition unknown', warehouseLocation: 'C-04', statusBefore: 'low-stock', statusAfter: 'low-stock' },
  { movementId: 'MOV-011', timestamp: '2026-03-05T08:00:00Z', sku: 'IRON-65', productName: 'Iron 65mg', quantity: 2, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10427', linkedOrderId: 'WOO-10427', linkedShipmentId: null, userId: 'ops-user-1', notes: '', warehouseLocation: 'B-07', statusBefore: 'low-stock', statusAfter: 'low-stock' },
  { movementId: 'MOV-012', timestamp: '2026-03-05T09:30:00Z', sku: 'IRON-65', productName: 'Iron 65mg', quantity: 2, direction: 'OUT', movementType: 'SHIPMENT_CONFIRMED', reasonCode: 'Shipment dispatched', sourceType: 'FedEx', sourceReference: '794644790132', linkedOrderId: 'WOO-10427', linkedShipmentId: 'FDX-10427', userId: 'warehouse-1', notes: '', warehouseLocation: 'B-07', statusBefore: 'low-stock', statusAfter: 'low-stock' },
  { movementId: 'MOV-013', timestamp: '2026-03-05T11:00:00Z', sku: 'TURM-500', productName: 'Turmeric Curcumin 500mg', quantity: 2, direction: 'IN', movementType: 'RETURN_RESTOCKED', reasonCode: 'Return — resellable condition', sourceType: 'Returns', sourceReference: 'RET-0305-01', linkedOrderId: 'WOO-10398', linkedShipmentId: null, userId: 'warehouse-1', notes: 'Condition: sealed, undamaged', warehouseLocation: 'B-11', statusBefore: 'out-of-stock', statusAfter: 'out-of-stock' },
  { movementId: 'MOV-014', timestamp: '2026-03-05T14:00:00Z', sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantity: 500, direction: 'IN', movementType: 'SUPPLIER_REPLENISHMENT', reasonCode: 'PO-2026-0042 received', sourceType: 'Supplier', sourceReference: 'PO-2026-0042', linkedOrderId: null, linkedShipmentId: null, userId: 'inv-mgr-1', notes: 'Full pallet received from vendor', warehouseLocation: 'A-12', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-015', timestamp: '2026-03-06T08:00:00Z', sku: 'VIT-B12-1000', productName: 'Vitamin B12 1000mcg', quantity: 1, direction: 'OUT', movementType: 'ORDER_RESERVED', reasonCode: 'Order reservation', sourceType: 'WooCommerce', sourceReference: 'WOO-10427', linkedOrderId: 'WOO-10427', linkedShipmentId: null, userId: 'ops-user-1', notes: '', warehouseLocation: 'A-06', statusBefore: 'in-stock', statusAfter: 'in-stock' },
  { movementId: 'MOV-016', timestamp: '2026-03-06T10:00:00Z', sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantity: 3, direction: 'OUT', movementType: 'SAMPLE_USE', reasonCode: 'Marketing samples', sourceType: 'Manual', sourceReference: 'ADJ-0306-01', linkedOrderId: null, linkedShipmentId: null, userId: 'ops-user-1', notes: 'Sent to trade show', warehouseLocation: 'A-12', statusBefore: 'in-stock', statusAfter: 'in-stock' },
];

// ── Supplier Manifests ──
export type InboundStatus = 'expected' | 'in-transit' | 'received' | 'partial-receipt' | 'short-receipt' | 'damaged-on-arrival' | 'overdue';

export interface SupplierManifest {
  manifestId: string;
  supplierName: string;
  supplierReference: string;
  shippedDate: string;
  expectedArrivalDate: string;
  receivedDate: string | null;
  rows: SupplierManifestRow[];
  inboundStatus: InboundStatus;
  notes: string;
  importedAt: string;
  importedBy: string;
}

export interface SupplierManifestRow {
  sku: string;
  productName: string;
  quantityShipped: number;
  quantityReceived: number | null;
  quantityShort: number;
  quantityDamaged: number;
  rowStatus: 'pending' | 'received' | 'short' | 'damaged' | 'partial';
}

export const mockSupplierManifests: SupplierManifest[] = [
  {
    manifestId: 'SM-2026-001', supplierName: 'NutraSource Labs', supplierReference: 'NSL-INV-44821',
    shippedDate: '2026-02-28', expectedArrivalDate: '2026-03-05', receivedDate: '2026-03-05',
    inboundStatus: 'received', notes: 'Full pallet received, all items verified',
    importedAt: '2026-03-01T08:00:00Z', importedBy: 'inv-mgr-1',
    rows: [
      { sku: 'VIT-C-500', productName: 'Vitamin C 500mg', quantityShipped: 500, quantityReceived: 500, quantityShort: 0, quantityDamaged: 0, rowStatus: 'received' },
      { sku: 'VIT-D-1000', productName: 'Vitamin D3 1000IU', quantityShipped: 300, quantityReceived: 300, quantityShort: 0, quantityDamaged: 0, rowStatus: 'received' },
    ]
  },
  {
    manifestId: 'SM-2026-002', supplierName: 'BioWell Ingredients', supplierReference: 'BW-SHP-9931',
    shippedDate: '2026-03-02', expectedArrivalDate: '2026-03-07', receivedDate: null,
    inboundStatus: 'in-transit', notes: 'Tracking: FDX-882716293',
    importedAt: '2026-03-03T10:00:00Z', importedBy: 'inv-mgr-1',
    rows: [
      { sku: 'OMEGA-3-120', productName: 'Omega 3 Fish Oil 120ct', quantityShipped: 200, quantityReceived: null, quantityShort: 0, quantityDamaged: 0, rowStatus: 'pending' },
      { sku: 'PROB-60', productName: 'Probiotic 60 Billion CFU', quantityShipped: 150, quantityReceived: null, quantityShort: 0, quantityDamaged: 0, rowStatus: 'pending' },
    ]
  },
  {
    manifestId: 'SM-2026-003', supplierName: 'NutraSource Labs', supplierReference: 'NSL-INV-44910',
    shippedDate: '2026-03-01', expectedArrivalDate: '2026-03-06', receivedDate: '2026-03-06',
    inboundStatus: 'short-receipt', notes: 'Collagen shipment 20 units short',
    importedAt: '2026-03-02T09:00:00Z', importedBy: 'inv-mgr-1',
    rows: [
      { sku: 'COLG-TYPE2', productName: 'Collagen Type II', quantityShipped: 100, quantityReceived: 80, quantityShort: 20, quantityDamaged: 0, rowStatus: 'short' },
    ]
  },
  {
    manifestId: 'SM-2026-004', supplierName: 'MineralPure Co', supplierReference: 'MPC-2026-0088',
    shippedDate: '2026-02-25', expectedArrivalDate: '2026-03-03', receivedDate: '2026-03-04',
    inboundStatus: 'damaged-on-arrival', notes: '8 units of ZNC-50 crushed in transit',
    importedAt: '2026-02-26T11:00:00Z', importedBy: 'warehouse-1',
    rows: [
      { sku: 'ZNC-50', productName: 'Zinc 50mg', quantityShipped: 100, quantityReceived: 92, quantityShort: 0, quantityDamaged: 8, rowStatus: 'damaged' },
      { sku: 'IRON-65', productName: 'Iron 65mg', quantityShipped: 50, quantityReceived: 50, quantityShort: 0, quantityDamaged: 0, rowStatus: 'received' },
    ]
  },
  {
    manifestId: 'SM-2026-005', supplierName: 'BioWell Ingredients', supplierReference: 'BW-SHP-10012',
    shippedDate: '2026-02-20', expectedArrivalDate: '2026-02-28', receivedDate: null,
    inboundStatus: 'overdue', notes: 'Carrier reports delay — no update since Mar 1',
    importedAt: '2026-02-21T14:00:00Z', importedBy: 'inv-mgr-1',
    rows: [
      { sku: 'TURM-500', productName: 'Turmeric Curcumin 500mg', quantityShipped: 200, quantityReceived: null, quantityShort: 0, quantityDamaged: 0, rowStatus: 'pending' },
    ]
  },
];

// ── Order Event Timeline ──
export interface OrderEvent {
  timestamp: string;
  eventType: string;
  description: string;
  user: string;
}

export const mockOrderEvents: Record<string, OrderEvent[]> = {
  'WOO-10421': [
    { timestamp: '2026-03-01T08:00:00Z', eventType: 'ORDER_IMPORTED', description: 'Order imported from WooCommerce export', user: 'ops-user-1' },
    { timestamp: '2026-03-01T08:15:00Z', eventType: 'ORDER_RESERVED', description: 'Stock reserved: VIT-C-500 ×2', user: 'ops-user-1' },
    { timestamp: '2026-03-02T10:30:00Z', eventType: 'STOCK_ALLOCATED', description: 'Stock allocated for shipment PS-88421', user: 'warehouse-1' },
    { timestamp: '2026-03-02T14:00:00Z', eventType: 'SHIPMENT_CONFIRMED', description: 'Shipped via USPS — 9400111899223456789012', user: 'warehouse-1' },
  ],
  'WOO-10422': [
    { timestamp: '2026-03-01T08:00:00Z', eventType: 'ORDER_IMPORTED', description: 'Order imported from WooCommerce export', user: 'ops-user-1' },
    { timestamp: '2026-03-01T08:16:00Z', eventType: 'RESERVATION_FAILED', description: 'OMEGA-3-120 out of stock — reservation failed', user: 'system' },
    { timestamp: '2026-03-03T09:00:00Z', eventType: 'EXCEPTION_FLAGGED', description: 'Exception: Stock unavailable for fulfillment', user: 'system' },
  ],
  'WOO-10423': [
    { timestamp: '2026-03-02T08:00:00Z', eventType: 'ORDER_IMPORTED', description: 'Order imported from WooCommerce export', user: 'ops-user-1' },
    { timestamp: '2026-03-02T09:00:00Z', eventType: 'ORDER_RESERVED', description: 'Stock reserved: MAG-400 ×1', user: 'ops-user-1' },
    { timestamp: '2026-03-03T10:00:00Z', eventType: 'SHIPMENT_CONFIRMED', description: 'Shipped via UPS — 1Z999AA10123456784', user: 'warehouse-1' },
    { timestamp: '2026-03-04T11:00:00Z', eventType: 'DELIVERED', description: 'Delivered to customer', user: 'system' },
  ],
  'WOO-10424': [
    { timestamp: '2026-03-02T08:00:00Z', eventType: 'ORDER_IMPORTED', description: 'Order imported from WooCommerce export', user: 'ops-user-1' },
    { timestamp: '2026-03-04T08:00:00Z', eventType: 'EXCEPTION_FLAGGED', description: 'Completed in Woo but no shipment record found', user: 'system' },
  ],
  'WOO-10425': [
    { timestamp: '2026-03-03T08:00:00Z', eventType: 'ORDER_IMPORTED', description: 'Order imported from WooCommerce export', user: 'ops-user-1' },
    { timestamp: '2026-03-04T10:00:00Z', eventType: 'ORDER_RESERVED', description: 'Stock reserved: PROB-60 ×1', user: 'ops-user-1' },
    { timestamp: '2026-03-04T15:00:00Z', eventType: 'LABEL_CREATED', description: 'USPS label created — preparing shipment', user: 'warehouse-1' },
  ],
};

// ── Exceptions ──
export const mockExceptions: ExceptionRecord[] = [
  { id: 'EXC-001', orderId: 'WOO-10422', type: 'Stock Unavailable', severity: 'high', description: 'OMEGA-3-120 out of stock — order cannot be fulfilled', detectedAt: '2026-03-03T09:00:00Z', resolved: false },
  { id: 'EXC-002', orderId: 'WOO-10424', type: 'Status Mismatch', severity: 'critical', description: 'Order marked completed in WooCommerce but no shipment record exists', detectedAt: '2026-03-04T08:00:00Z', resolved: false },
  { id: 'EXC-003', orderId: 'WOO-10428', type: 'Backorder', severity: 'medium', description: 'SKU OMEGA-3-120 backordered — no confirmed restock date', detectedAt: '2026-03-05T09:00:00Z', resolved: false },
  { id: 'EXC-004', orderId: 'WOO-10415', type: 'Missing Tracking', severity: 'low', description: 'Shipment created 5 days ago but tracking not scanning', detectedAt: '2026-03-02T12:00:00Z', resolved: true },
  { id: 'EXC-005', orderId: 'SM-2026-005', type: 'Overdue Inbound', severity: 'high', description: 'Supplier shipment BW-SHP-10012 overdue — TURM-500 restock blocked', detectedAt: '2026-03-01T00:00:00Z', resolved: false },
  { id: 'EXC-006', orderId: 'SM-2026-003', type: 'Short Receipt', severity: 'medium', description: 'Supplier manifest SM-2026-003 short 20 units of COLG-TYPE2', detectedAt: '2026-03-06T12:00:00Z', resolved: false },
];

export const kpiData = {
  totalOrders: 847,
  totalShipments: 792,
  totalSKUs: 156,
  stockOnHand: 14280,
  ordersMatched: 768,
  ordersUnmatched: 79,
  shipmentsUnmatched: 24,
  backlogOrders: 43,
  awaitingShipment: 31,
  delayedByStock: 18,
  ordersShipped: 724,
  missingTracking: 12,
  exceptions: 9,
  lowStockItems: 14,
  outOfStockItems: 5,
  supplierManifests: 5,
  inboundExpected: 2,
  inboundReceived: 3,
  inboundOverdue: 1,
};

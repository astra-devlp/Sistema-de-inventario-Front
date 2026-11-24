/** Tipos de `stock_movements` (`MovementType` del back). */
export type MovementType =
  | 'inventario_inicial'
  | 'entrada'
  | 'merma'
  | 'ajuste'
  | 'venta'
  | 'anulacion'
  | 'devolucion_cliente'
  | 'traslado_salida'
  | 'traslado_entrada';

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  inventario_inicial: 'Inventario inicial',
  entrada: 'Entrada',
  merma: 'Merma',
  ajuste: 'Ajuste',
  venta: 'Venta',
  anulacion: 'Anulación',
  devolucion_cliente: 'Devolución de cliente',
  traslado_salida: 'Traslado (sale)',
  traslado_entrada: 'Traslado (entra)',
};

/** Cantidades y saldos llegan como cadenas decimales (`"12.500"`). */
export interface StockLevel {
  product_id: number;
  location_id: number;
  quantity: string;
  /** Costo promedio ponderado en la sede; `null` si nunca entró con costo. */
  average_cost: string | null;
  /** Saldo × costo promedio; `null` sin costo promedio. */
  total_value: string | null;
}

export interface StockMovement {
  id: number;
  location_id: number;
  product_id: number;
  movement_type: MovementType;
  /** Con signo: positiva entra, negativa sale. */
  quantity: string;
  created_at: string;
  user_id: number;
  reason: string | null;
  sale_id: number | null;
  sale_line_id: number | null;
  unit_cost: string | null;
  average_cost: string | null;
  transfer_id: number | null;
}

export interface MovementFilters {
  locationId: number | null;
  productId: number | null;
  movementType: MovementType | '';
  limit: number;
  offset: number;
}

export interface EntryPayload {
  location_id: number;
  product_id: number;
  quantity: string;
  /** Costo unitario de la compra; sin él, el back usa el costo del producto. */
  unit_cost: string | null;
  reason: string | null;
}

export interface LossPayload {
  location_id: number;
  product_id: number;
  quantity: string;
  reason: string;
}

/** El ajuste envía lo contado: el back calcula la diferencia contra el saldo. */
export interface AdjustmentPayload {
  location_id: number;
  product_id: number;
  counted_quantity: string;
  reason: string;
}

export interface InitialStockPayload {
  location_id: number;
  reason: string | null;
  items: { product_id: number; quantity: string }[];
}

/** Mínimo propio de un producto en una sede (`PUT /locations/{id}/stock-minimums/{product}`). */
export interface StockMinimum {
  location_id: number;
  product_id: number;
  min_quantity: string;
  updated_at: string;
}

/** Producto con stock menor o igual a su mínimo (`GET /stock/alerts`). */
export interface StockAlert {
  product_id: number;
  product_name: string;
  sku: string;
  location_id: number;
  location_name: string;
  quantity: string;
  min_quantity: string;
  missing: string;
}

export interface StockValuation {
  total_value: string;
  items_without_cost: number;
  locations: { location_id: number; location_name: string; total_value: string; items_without_cost: number }[];
}

export interface TransferPayload {
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: string;
  reason: string | null;
}

export interface StockTransfer {
  id: number;
  product_id: number;
  from_location_id: number;
  to_location_id: number;
  quantity: string;
  unit_cost: string | null;
  user_id: number;
  reason: string | null;
  created_at: string;
  movements: StockMovement[];
}

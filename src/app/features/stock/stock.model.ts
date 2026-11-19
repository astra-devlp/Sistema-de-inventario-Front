/** Tipos de `stock_movements` (`MovementType` del back). */
export type MovementType =
  | 'inventario_inicial'
  | 'entrada'
  | 'merma'
  | 'ajuste'
  | 'venta'
  | 'anulacion'
  | 'devolucion_cliente';

export const MOVEMENT_LABELS: Record<MovementType, string> = {
  inventario_inicial: 'Inventario inicial',
  entrada: 'Entrada',
  merma: 'Merma',
  ajuste: 'Ajuste',
  venta: 'Venta',
  anulacion: 'Anulación',
  devolucion_cliente: 'Devolución de cliente',
};

/** Cantidades y saldos llegan como cadenas decimales (`"12.500"`). */
export interface StockLevel {
  product_id: number;
  location_id: number;
  quantity: string;
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

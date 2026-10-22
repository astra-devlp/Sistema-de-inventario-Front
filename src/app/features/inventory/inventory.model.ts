/** La API serializa los Decimal como texto; se convierten con `toNumber` antes de mostrarlos. */
export type DecimalValue = string | number;

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

export interface WarehousePayload {
  code: string;
  name: string;
  address: string | null;
  is_active: boolean;
}

export interface Stock {
  id: number;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  quantity: DecimalValue;
  min_stock: DecimalValue;
  average_cost: DecimalValue;
  total_value: DecimalValue;
  is_low: boolean;
}

export type MovementType = 'entrada' | 'salida' | 'ajuste';

export interface Movement {
  id: number;
  movement_type: MovementType;
  movement_type_label: string;
  product_id: number;
  product_name: string | null;
  product_sku: string | null;
  warehouse_id: number;
  warehouse_name: string | null;
  quantity: DecimalValue;
  unit_cost: DecimalValue;
  total_cost: DecimalValue;
  balance_after: DecimalValue;
  average_cost_after: DecimalValue;
  reference: string | null;
  note: string | null;
  user_name: string | null;
  created_at: string;
}

export interface MovementPayload {
  movement_type: MovementType;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  unit_cost: number | null;
  reference: string | null;
  note: string | null;
}

export interface MinimumStockPayload {
  product_id: number;
  warehouse_id: number;
  min_stock: number;
}

export interface InventorySummary {
  warehouses: number;
  products_with_stock: number;
  low_stock: number;
  total_value: DecimalValue;
}

/** Lo mínimo del producto que necesita el formulario de movimientos. */
export interface ProductOption {
  id: number;
  name: string;
  sku: string;
  cost: DecimalValue | null;
  is_active: boolean;
}

/** Valores para abrir el formulario de movimiento ya diligenciado desde una existencia. */
export interface MovementPreset {
  movement_type: MovementType;
  product_id: number;
  warehouse_id: number;
}

export const MOVEMENT_TYPES: { code: MovementType; label: string; hint: string }[] = [
  { code: 'entrada', label: 'Entrada', hint: 'Suma existencia y recalcula el costo promedio.' },
  { code: 'salida', label: 'Salida', hint: 'Resta existencia al costo promedio vigente.' },
  { code: 'ajuste', label: 'Ajuste', hint: 'Escribe la cantidad contada; se registra la diferencia.' },
];

export const MOVEMENT_BADGE: Record<MovementType, string> = {
  entrada: 'badge--success',
  salida: 'badge--danger',
  ajuste: 'badge--info',
};

export function toNumber(value: DecimalValue | null | undefined): number {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const quantityFormat = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 3 });
const moneyFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatQuantity(value: DecimalValue | null | undefined): string {
  return quantityFormat.format(toNumber(value));
}

export function formatMoney(value: DecimalValue | null | undefined): string {
  return moneyFormat.format(toNumber(value));
}

/** Cantidad con signo para el historial: +10, -5. */
export function formatSignedQuantity(value: DecimalValue): string {
  const number = toNumber(value);
  return `${number > 0 ? '+' : ''}${quantityFormat.format(number)}`;
}

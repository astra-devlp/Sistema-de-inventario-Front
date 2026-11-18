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

export type MovementType = 'entrada' | 'salida' | 'ajuste' | 'traslado';

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
  /** Solo en traslados: la otra bodega (destino si la cantidad es negativa, origen si es positiva). */
  counterpart_warehouse_id: number | null;
  counterpart_warehouse_name: string | null;
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

export interface TransferPayload {
  product_id: number;
  from_warehouse_id: number;
  to_warehouse_id: number;
  quantity: number;
  reference: string | null;
  note: string | null;
}

export interface Transfer {
  outgoing: Movement;
  incoming: Movement;
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
  {
    code: 'ajuste',
    label: 'Ajuste',
    hint: 'Escribe cuántas unidades contaste (no cuántas quitas). La diferencia se registra al costo promedio.',
  },
  { code: 'traslado', label: 'Traslado', hint: 'Mueve existencia a otra bodega al costo promedio de la bodega de origen.' },
];

export const MOVEMENT_BADGE: Record<MovementType, string> = {
  entrada: 'badge--success',
  salida: 'badge--danger',
  ajuste: 'badge--info',
  traslado: 'badge--primary',
};

export const MOVEMENT_ICON: Record<MovementType, 'upload' | 'download' | 'settings' | 'arrows'> = {
  entrada: 'upload',
  salida: 'download',
  ajuste: 'settings',
  traslado: 'arrows',
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

const moneyInputFormat = new Intl.NumberFormat('es-CO', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Formato editable: 1.250.000,50 (miles con punto, decimales con coma). */
export function formatMoneyInput(value: DecimalValue | null | undefined): string {
  const amount = toNumber(value);
  if (!Number.isFinite(amount)) return '';
  return moneyInputFormat.format(amount);
}

/** Parsea montos escritos en es-CO ($ 1.250.000,50 → 1250000.5). */
export function parseMoneyInput(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  let text = String(raw).trim();
  if (!text) return null;
  text = text.replace(/[$\s]|COP/gi, '');
  if (!text) return null;

  const hasComma = text.includes(',');
  const hasDot = text.includes('.');
  if (hasComma && hasDot) {
    // 1.250.000,50 → quitar miles, coma → punto
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (hasComma) {
    text = text.replace(',', '.');
  } else if (hasDot) {
    // Solo puntos: miles (1.250.000 / 150.000) vs decimal anglosajón (1500.5).
    const parts = text.split('.');
    const last = parts[parts.length - 1] ?? '';
    if (parts.length > 2 || last.length === 3) {
      text = parts.join('');
    }
  }

  text = text.replace(/[^\d.-]/g, '');
  if (!text || text === '-' || text === '.') return null;
  const amount = Number(text);
  return Number.isFinite(amount) ? amount : null;
}

/** Cantidad con signo para el historial: +10, -5. */
export function formatSignedQuantity(value: DecimalValue): string {
  const number = toNumber(value);
  return `${number > 0 ? '+' : ''}${quantityFormat.format(number)}`;
}

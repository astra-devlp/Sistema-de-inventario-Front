import type { UnitType } from '@features/products/catalog.model';
import { QuantityResult, parseQuantity } from './quantity';

/**
 * Mínimo que aplica a un producto en una sede: el propio de la sede si existe (aunque sea cero), si no el
 * `min_stock` del producto. Es la misma regla del back (`effective_minimum`); la alerta la decide el back.
 */
export function minimumFor(own: string | undefined, productMinStock: number): string {
  return own ?? String(productMinStock);
}

export interface TransferInput {
  fromLocationId: number | null;
  toLocationId: number | null;
  quantity: string;
  unitType: UnitType | null | undefined;
}

/** Valida un traslado antes de enviarlo. El stock suficiente lo verifica el back con el producto bloqueado. */
export function validateTransfer(input: TransferInput): QuantityResult {
  if (input.fromLocationId === null || input.toLocationId === null) return { ok: false, error: 'Elige la sede de destino' };
  if (input.fromLocationId === input.toLocationId) {
    return { ok: false, error: 'La sede de origen y la de destino deben ser distintas' };
  }
  return parseQuantity(input.quantity, input.unitType);
}

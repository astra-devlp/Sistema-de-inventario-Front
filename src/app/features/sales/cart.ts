import type { UnitType } from '@features/products/catalog.model';
import { MAX_LINES, MAX_LINE_QUANTITY, cartTotal, hasSellablePrice } from './sale-math';
import { addQuantity, compareQuantity, parseQuantity } from '../stock/quantity';
import { LookupResponse, PosProduct } from './sale.model';

export interface CartLine {
  product: PosProduct;
  /** Cadena decimal: nunca `number`. */
  quantity: string;
  unitType: UnitType | null;
}

export type CartResult = { ok: true; lines: CartLine[] } | { ok: false; error: string };

/** Valida una cantidad del carrito: por unidad (enteras si es «Cantidad»), hasta 3 decimales y máximo 100000. */
export function validateLineQuantity(raw: string, unitType: UnitType | null): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = parseQuantity(raw, unitType);
  if (!parsed.ok) return parsed;
  if (compareQuantity(parsed.value, MAX_LINE_QUANTITY) > 0) {
    return { ok: false, error: `La cantidad por renglón no puede superar ${MAX_LINE_QUANTITY}` };
  }
  return parsed;
}

/** Agrega una unidad del producto: si ya está en el carrito suma 1 a su renglón (un producto por renglón). */
export function addProduct(lines: CartLine[], product: PosProduct, unitType: UnitType | null): CartResult {
  if (!hasSellablePrice(product.price_with_tax)) {
    return { ok: false, error: `«${product.name}» no tiene precio: ponle un precio antes de venderlo` };
  }
  const index = lines.findIndex((line) => line.product.id === product.id);
  if (index === -1) {
    if (lines.length >= MAX_LINES) return { ok: false, error: `El carrito admite como máximo ${MAX_LINES} renglones` };
    return { ok: true, lines: [...lines, { product, quantity: '1', unitType }] };
  }
  const quantity = addQuantity(lines[index].quantity, '1');
  const checked = validateLineQuantity(quantity, lines[index].unitType);
  if (!checked.ok) return { ok: false, error: `${product.name}: ${checked.error}` };
  return { ok: true, lines: lines.map((line, i) => (i === index ? { ...line, quantity: checked.value } : line)) };
}

/** Cambia la cantidad de un renglón tras validarla. */
export function setLineQuantity(lines: CartLine[], productId: number, raw: string): CartResult {
  const index = lines.findIndex((line) => line.product.id === productId);
  if (index === -1) return { ok: true, lines };
  const checked = validateLineQuantity(raw, lines[index].unitType);
  if (!checked.ok) return { ok: false, error: checked.error };
  return { ok: true, lines: lines.map((line, i) => (i === index ? { ...line, quantity: checked.value } : line)) };
}

export function removeLine(lines: CartLine[], productId: number): CartLine[] {
  return lines.filter((line) => line.product.id !== productId);
}

/** Total de la vista previa del carrito. */
export function cartPreviewTotal(lines: CartLine[]): string {
  return cartTotal(lines.map((line) => ({ priceWithTax: line.product.price_with_tax, quantity: line.quantity })));
}

export type LookupDecision =
  | { action: 'add'; product: PosProduct }
  | { action: 'choose'; products: PosProduct[]; hasMore: boolean }
  | { action: 'none' };

/**
 * Qué hacer con la respuesta del buscador: `code` o `sku` con un solo resultado se agrega directo; `name`, o
 * varios resultados, se muestra la lista para elegir; `none` avisa. (Los 409 llegan como error, no aquí.)
 */
export function decideLookup(response: LookupResponse): LookupDecision {
  if (response.match === 'none' || response.items.length === 0) return { action: 'none' };
  if ((response.match === 'code' || response.match === 'sku') && response.items.length === 1) {
    return { action: 'add', product: response.items[0] };
  }
  return { action: 'choose', products: response.items, hasMore: response.has_more };
}

import type { UnitType } from '@features/products/catalog.model';

/**
 * Cantidades de stock: cadenas decimales de hasta 3 decimales (`NUMERIC(12,3)`). Nunca se pasan por `number`: la
 * comparación usa `bigint` en milésimas. Reproduce `quantity_error` de `stock_rules.py` del back; la API sigue
 * siendo quien decide (422), esto solo evita enviar lo que ya se sabe inválido.
 */
export const QUANTITY_DECIMALS = 3;
export const MAX_QUANTITY = '999999999.999';

export type QuantityResult = { ok: true; value: string } | { ok: false; error: string };

const NUMBER_RE = /^\d+(?:\.\d+)?$/;

/** Milésimas de una cantidad ya normalizada (`"12.5"` → `12500n`). */
function toMilli(value: string): bigint {
  const [int, frac = ''] = value.split('.');
  return BigInt(int) * 1000n + BigInt(frac.padEnd(QUANTITY_DECIMALS, '0'));
}

/** Compara dos cantidades decimales: -1, 0 o 1. */
export function compareQuantity(a: string, b: string): -1 | 0 | 1 {
  const x = toMilli(normalize(a));
  const y = toMilli(normalize(b));
  return x < y ? -1 : x > y ? 1 : 0;
}

function normalize(raw: string): string {
  const [int, frac = ''] = raw.trim().replace(',', '.').split('.');
  const cleanInt = int.replace(/^0+(?=\d)/, '') || '0';
  const cleanFrac = frac.replace(/0+$/, '');
  return cleanFrac ? `${cleanInt}.${cleanFrac}` : cleanInt;
}

/** `"50.000"` → `"50"`, `"12.500"` → `"12.5"`: las cantidades del back traen ceros de relleno. */
export function formatQuantity(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const text = value.trim();
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  return NUMBER_RE.test(body) ? `${negative ? '-' : ''}${normalize(body)}` : text;
}

/**
 * Valida y normaliza una cantidad escrita a mano. `allowZero` es para el conteo de un ajuste. Las unidades de tipo
 * «Cantidad» no aceptan decimales; las de peso, volumen y longitud sí, hasta 3.
 */
export function parseQuantity(raw: string, unitType: UnitType | null | undefined, allowZero = false): QuantityResult {
  const text = raw.trim().replace(',', '.');
  if (text.startsWith('-')) {
    return { ok: false, error: allowZero ? 'La cantidad debe ser mayor o igual a cero' : 'La cantidad debe ser mayor que cero' };
  }
  if (!NUMBER_RE.test(text)) return { ok: false, error: 'La cantidad no es un número válido' };

  const value = normalize(text);
  if (value === '0' && !allowZero) return { ok: false, error: 'La cantidad debe ser mayor que cero' };
  if (compareQuantity(value, MAX_QUANTITY) > 0) {
    return { ok: false, error: `La cantidad no puede superar ${MAX_QUANTITY}` };
  }
  const decimals = value.split('.')[1]?.length ?? 0;
  if (decimals > QUANTITY_DECIMALS) {
    return { ok: false, error: `La cantidad admite como máximo ${QUANTITY_DECIMALS} decimales` };
  }
  if (unitType === 'Cantidad' && decimals > 0) {
    return { ok: false, error: 'El producto se maneja por unidades enteras: la cantidad no puede tener decimales' };
  }
  return { ok: true, value };
}

/** Suma dos cantidades decimales sin pasar por `number` (`"0.1" + "1"` → `"1.1"`). */
export function addQuantity(a: string, b: string): string {
  const sum = toMilli(normalize(a)) + toMilli(normalize(b));
  const text = sum.toString().padStart(QUANTITY_DECIMALS + 1, '0');
  const int = text.slice(0, -QUANTITY_DECIMALS);
  const frac = text.slice(-QUANTITY_DECIMALS).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

/** Resta `b` de `a` sin pasar por `number`; si `b` es mayor, el resultado es `"0"` (lo que queda por devolver, nunca negativo). */
export function subtractQuantity(a: string, b: string): string {
  const diff = toMilli(normalize(a)) - toMilli(normalize(b));
  if (diff <= 0n) return '0';
  const text = diff.toString().padStart(QUANTITY_DECIMALS + 1, '0');
  const int = text.slice(0, -QUANTITY_DECIMALS);
  const frac = text.slice(-QUANTITY_DECIMALS).replace(/0+$/, '');
  return frac ? `${int}.${frac}` : int;
}

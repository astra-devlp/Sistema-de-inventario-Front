/**
 * Dinero: cadenas decimales de hasta 2 decimales (`"50000.00"`), como las manda y las recibe el back. Nunca se pasan
 * por `number`: comparar y formatear trabaja sobre el texto o sobre `bigint` en centavos.
 */
export const MONEY_DECIMALS = 2;
/** `max_digits=12, decimal_places=2` en el back: 10 dígitos enteros. */
export const MAX_MONEY = '9999999999.99';

export type MoneyResult = { ok: true; value: string } | { ok: false; error: string };

const NUMBER_RE = /^\d+(?:\.\d+)?$/;

function toCents(value: string): bigint {
  const [int, frac = ''] = value.split('.');
  return BigInt(int) * 100n + BigInt(frac.padEnd(MONEY_DECIMALS, '0').slice(0, MONEY_DECIMALS));
}

/**
 * Valida un monto escrito a mano (no negativo, hasta 2 decimales) y lo normaliza a 2 decimales (`"50000"` →
 * `"50000.00"`). Acepta coma o punto como separador decimal; no admite separadores de miles, porque `50.000` sería
 * ambiguo (¿cincuenta o cincuenta mil?).
 */
export function parseMoney(raw: string): MoneyResult {
  const text = raw.trim().replace(',', '.');
  if (!text) return { ok: false, error: 'Escribe el monto' };
  if (text.startsWith('-')) return { ok: false, error: 'El monto no puede ser negativo' };
  if (!NUMBER_RE.test(text)) {
    return { ok: false, error: 'El monto no es un número válido: escríbelo sin separadores de miles (ej. 50000 o 50000.50)' };
  }
  const [intRaw, fracRaw = ''] = text.split('.');
  const int = intRaw.replace(/^0+(?=\d)/, '');
  const frac = fracRaw.replace(/0+$/, '');
  if (frac.length > MONEY_DECIMALS) return { ok: false, error: `El monto admite como máximo ${MONEY_DECIMALS} decimales` };
  const value = `${int}.${frac.padEnd(MONEY_DECIMALS, '0')}`;
  if (toCents(value) > toCents(MAX_MONEY)) return { ok: false, error: 'El monto es demasiado grande' };
  return { ok: true, value };
}

/** `true` si el monto es negativo (y no cero). */
export function isNegativeMoney(value: string | null | undefined): boolean {
  return !!value && value.trim().startsWith('-') && /[1-9]/.test(value);
}

/** `true` si el monto es exactamente cero (`"0"`, `"0.00"`, `"-0.00"`). */
export function isZeroMoney(value: string | null | undefined): boolean {
  return !!value && NUMBER_RE.test(value.trim().replace(/^-/, '')) && !/[1-9]/.test(value);
}

/** Pesos colombianos para mostrar: `"50000.00"` → `$ 50.000`, `"-1500.50"` → `-$ 1.500,50`. Cadenas, sin `number`. */
export function formatCop(value: string | null | undefined): string {
  if (value === null || value === undefined || value.trim() === '') return '—';
  const text = value.trim();
  const negative = isNegativeMoney(text);
  const body = text.replace(/^-/, '');
  if (!NUMBER_RE.test(body)) return text;
  const [int, frac = ''] = body.split('.');
  const grouped = int.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const cents = frac.replace(/0+$/, '');
  return `${negative ? '-' : ''}$ ${grouped}${cents ? `,${cents.padEnd(MONEY_DECIMALS, '0').slice(0, MONEY_DECIMALS)}` : ''}`;
}

/** Valor absoluto de un monto en texto (`"-500.00"` → `"500.00"`). */
export function absMoney(value: string): string {
  return value.trim().replace(/^-/, '');
}

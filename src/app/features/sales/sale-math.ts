/**
 * Cálculos de la venta: réplica de `sale_rules.py` del back con aritmética entera (`bigint`), sin `number`.
 *
 * El total del carrito es una **vista previa**: la venta la vuelve a calcular el servidor con el precio de ese
 * momento y la respuesta es la que vale. Por renglón, `precio_con_IVA × cantidad` se redondea a 2 decimales con
 * redondeo comercial (mitad hacia arriba, `ROUND_HALF_UP`) y la venta suma los renglones ya redondeados.
 */
export const MAX_LINES = 200;
export const MAX_LINE_QUANTITY = '100000';

const NUMBER_RE = /^\d+(?:\.\d+)?$/;

/** Divide enteros no negativos redondeando la mitad hacia arriba. */
function divRound(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

function scaled(value: string, decimals: number): bigint {
  const text = value.trim();
  if (!NUMBER_RE.test(text)) throw new Error(`Número inválido: ${value}`);
  const [int, frac = ''] = text.split('.');
  return BigInt(int) * 10n ** BigInt(decimals) + BigInt(frac.padEnd(decimals, '0').slice(0, decimals));
}

/** Centavos a texto con 2 decimales (`123456n` → `"1234.56"`). */
export function centsToMoney(cents: bigint): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const text = abs.toString().padStart(3, '0');
  return `${negative ? '-' : ''}${text.slice(0, -2)}.${text.slice(-2)}`;
}

/** Texto con hasta 2 decimales a centavos. */
export function moneyToCents(value: string): bigint {
  return scaled(value, 2);
}

/** `price_with_tax × cantidad` a centavos, mitad hacia arriba (precio en centavos × cantidad en milésimas ÷ 1000). */
export function lineTotalCents(priceWithTax: string, quantity: string): bigint {
  return divRound(scaled(priceWithTax, 2) * scaled(quantity, 3), 1000n);
}

export function lineTotal(priceWithTax: string, quantity: string): string {
  return centsToMoney(lineTotalCents(priceWithTax, quantity));
}

export interface LineAmounts {
  base: string;
  tax: string;
  total: string;
}

/**
 * Base e IVA de un renglón, igual que el back: el IVA sale por resta, así que base + IVA es exactamente el total.
 * El front no lo necesita para el carrito (el buscador no trae la tarifa); está para probar la misma regla.
 */
export function lineAmounts(priceWithTax: string, quantity: string, taxRate: string, isExempt: boolean): LineAmounts {
  const total = lineTotalCents(priceWithTax, quantity);
  const rate = scaled(taxRate, 2); // centésimas de punto porcentual: 19 → 1900
  if (isExempt || rate <= 0n) return { base: centsToMoney(total), tax: '0.00', total: centsToMoney(total) };
  const base = divRound(total * 10000n, 10000n + rate);
  return { base: centsToMoney(base), tax: centsToMoney(total - base), total: centsToMoney(total) };
}

export interface CartPriceLine {
  priceWithTax: string;
  quantity: string;
}

/** Total de la vista previa: suma de los renglones, cada uno redondeado por separado. */
export function cartTotal(lines: CartPriceLine[]): string {
  return centsToMoney(lines.reduce((sum, line) => sum + lineTotalCents(line.priceWithTax, line.quantity), 0n));
}

/** Un producto con precio cero (o negativo, o ilegible) no se puede vender: `producto_sin_precio`. */
export function hasSellablePrice(priceWithTax: string | null | undefined): boolean {
  if (!priceWithTax || !NUMBER_RE.test(priceWithTax.trim())) return false;
  return scaled(priceWithTax, 2) > 0n;
}

// ---- pagos ----------------------------------------------------------------------------------------------

export type PaymentMethod = 'efectivo' | 'tarjeta' | 'transferencia';

export interface PaymentInput {
  method: PaymentMethod;
  /** Tarjeta y transferencia: lo cobrado por ese medio. Efectivo: lo que **entrega** el cliente. */
  amount: string;
}

export interface AppliedPayment {
  method: PaymentMethod;
  /** Lo aplicado a la venta. */
  amount: string;
  /** Solo en efectivo: lo recibido. */
  received: string | null;
}

export type SettleResult =
  | { ok: true; applied: AppliedPayment[]; change: string }
  | { ok: false; error: string };

/**
 * Reparto de los pagos sobre el total, como `settle_payments`: tarjeta y transferencia se aplican por su valor y
 * juntas no pueden superar el total; el efectivo cubre lo que falta y el resto es el vuelto.
 */
export function settlePayments(total: string, payments: PaymentInput[]): SettleResult {
  const totalCents = moneyToCents(total);
  const methods = payments.map((p) => p.method);
  if (new Set(methods).size !== methods.length) return { ok: false, error: 'Cada medio de pago puede venir una sola vez' };
  if (payments.length === 0) return { ok: false, error: 'Agrega al menos un medio de pago' };

  const amounts = new Map<PaymentMethod, bigint>();
  for (const payment of payments) {
    if (!NUMBER_RE.test(payment.amount.trim()) || (payment.amount.split('.')[1]?.replace(/0+$/, '').length ?? 0) > 2) {
      return { ok: false, error: 'Cada pago debe ser mayor que cero y tener como máximo 2 decimales' };
    }
    const cents = moneyToCents(payment.amount);
    if (cents <= 0n) return { ok: false, error: 'Cada pago debe ser mayor que cero y tener como máximo 2 decimales' };
    amounts.set(payment.method, cents);
  }

  const card = amounts.get('tarjeta') ?? 0n;
  const transfer = amounts.get('transferencia') ?? 0n;
  const cash = amounts.get('efectivo');
  const nonCash = card + transfer;
  if (nonCash > totalCents) {
    return {
      ok: false,
      error: `Los pagos con tarjeta y transferencia suman ${centsToMoney(nonCash)} y superan el total de la venta (${centsToMoney(totalCents)}): solo el efectivo da cambio`,
    };
  }
  const remaining = totalCents - nonCash;
  const applied: AppliedPayment[] = [];
  if (amounts.has('tarjeta')) applied.push({ method: 'tarjeta', amount: centsToMoney(card), received: null });
  if (amounts.has('transferencia')) applied.push({ method: 'transferencia', amount: centsToMoney(transfer), received: null });

  if (cash === undefined) {
    if (remaining > 0n) return { ok: false, error: `Los pagos no cubren el total de la venta: faltan ${centsToMoney(remaining)}` };
    return { ok: true, applied, change: '0.00' };
  }
  if (remaining === 0n) {
    return { ok: false, error: 'La venta ya está cubierta con tarjeta y transferencia: no se recibe efectivo' };
  }
  if (cash < remaining) {
    return {
      ok: false,
      error: `El efectivo recibido (${centsToMoney(cash)}) no cubre lo que falta por pagar (${centsToMoney(remaining)}): faltan ${centsToMoney(remaining - cash)}`,
    };
  }
  applied.push({ method: 'efectivo', amount: centsToMoney(remaining), received: centsToMoney(cash) });
  return { ok: true, applied, change: centsToMoney(cash - remaining) };
}

/** Lo que falta por pagar en efectivo si tarjeta y transferencia ya cubren una parte (para el botón «Exacto»). */
export function remainingForCash(total: string, nonCashAmounts: string[]): string {
  const paid = nonCashAmounts.reduce((sum, amount) => sum + (NUMBER_RE.test(amount) ? moneyToCents(amount) : 0n), 0n);
  const remaining = moneyToCents(total) - paid;
  return centsToMoney(remaining < 0n ? 0n : remaining);
}

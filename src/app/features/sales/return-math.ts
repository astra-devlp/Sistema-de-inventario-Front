import { addQuantity, compareQuantity, parseQuantity, subtractQuantity } from '../stock/quantity';
import type { UnitType } from '@features/products/catalog.model';
import { PaymentMethod, centsToMoney, lineAmounts, moneyToCents } from './sale-math';
import type { SaleReturn } from './return.model';
import type { SaleLine, SalePayment } from './sale.model';

/**
 * Cálculos de una devolución: réplica de `return_rules.py` del back, con enteros (`bigint`), sin `number`.
 * El valor que se muestra es una vista previa: el servidor lo recalcula y su `total` es el que vale.
 */

export interface ReturnedSoFar {
  quantity: string;
  /** Valor ya devuelto del renglón, IVA incluido (centavos como texto, `"1000.00"`). */
  amount: string;
  tax: string;
}

const NOTHING: ReturnedSoFar = { quantity: '0', amount: '0.00', tax: '0.00' };

/** Lo ya devuelto por renglón, sumando las devoluciones de la venta (su valor exacto sale de ahí, no de una estimación). */
export function returnedByLine(returns: SaleReturn[]): Map<number, ReturnedSoFar> {
  const sums = new Map<number, { quantity: string; amount: bigint; tax: bigint }>();
  for (const saleReturn of returns) {
    for (const line of saleReturn.lines) {
      const sum = sums.get(line.sale_line_id) ?? { quantity: '0', amount: 0n, tax: 0n };
      sums.set(line.sale_line_id, {
        quantity: addQuantity(sum.quantity, line.quantity),
        amount: sum.amount + moneyToCents(line.amount),
        tax: sum.tax + moneyToCents(line.tax_amount),
      });
    }
  }
  return new Map([...sums].map(([id, s]) => [id, { quantity: s.quantity, amount: centsToMoney(s.amount), tax: centsToMoney(s.tax) }]));
}

export type ReturnableLine = Pick<
  SaleLine,
  'id' | 'quantity' | 'unit_price_with_tax' | 'tax_rate' | 'is_exempt' | 'line_total' | 'line_tax' | 'returned_quantity'
>;

/** Lo que aún se puede devolver del renglón: vendido menos ya devuelto. */
export function availableToReturn(line: Pick<SaleLine, 'quantity' | 'returned_quantity'>): string {
  return subtractQuantity(line.quantity, line.returned_quantity);
}

/**
 * (valor, IVA) de devolver `quantity` de un renglón del que ya se devolvió `returned`. Con el precio y el IVA que
 * quedaron guardados en el renglón; el tramo que lo completa se lleva lo que falte, así el residuo de centavos cae
 * en el último y la suma de los tramos es exactamente lo que se cobró.
 */
export function trancheAmounts(line: ReturnableLine, quantity: string, returned: ReturnedSoFar = NOTHING): { amount: string; tax: string } {
  const remainingAmount = moneyToCents(line.line_total) - moneyToCents(returned.amount);
  const remainingTax = moneyToCents(line.line_tax) - moneyToCents(returned.tax);
  if (compareQuantity(addQuantity(returned.quantity, quantity), line.quantity) === 0) {
    return { amount: centsToMoney(remainingAmount), tax: centsToMoney(remainingTax) };
  }
  const part = lineAmounts(line.unit_price_with_tax, quantity, line.tax_rate, line.is_exempt);
  const partTotal = moneyToCents(part.total);
  const amount = partTotal < remainingAmount ? partTotal : remainingAmount;
  const partTax = moneyToCents(part.tax);
  const tax = [partTax, remainingTax, amount].reduce((min, v) => (v < min ? v : min));
  return { amount: centsToMoney(amount), tax: centsToMoney(tax) };
}

export interface ReturnSelection {
  line: ReturnableLine;
  quantity: string;
}

/** Valor de la devolución: suma de los tramos de los renglones elegidos. */
export function returnTotal(selection: ReturnSelection[], returned: Map<number, ReturnedSoFar>): string {
  const cents = selection.reduce((sum, item) => sum + moneyToCents(trancheAmounts(item.line, item.quantity, returned.get(item.line.id)).amount), 0n);
  return centsToMoney(cents);
}

/** Valida la cantidad escrita para un renglón: por unidad, mayor que cero y no más de lo vendido menos lo ya devuelto. */
export function validateReturnQuantity(
  raw: string,
  unitType: UnitType | null,
  line: Pick<SaleLine, 'quantity' | 'returned_quantity'>,
): { ok: true; value: string } | { ok: false; error: string } {
  const parsed = parseQuantity(raw, unitType);
  if (!parsed.ok) return parsed;
  const available = availableToReturn(line);
  if (compareQuantity(parsed.value, available) > 0) {
    return { ok: false, error: `Se pueden devolver como máximo ${available} (se vendieron ${line.quantity} y ya se devolvieron ${line.returned_quantity})` };
  }
  return parsed;
}

// ---- reembolsos -----------------------------------------------------------------------------------------

export type PaymentCap = Pick<SalePayment, 'method' | 'amount' | 'refunded_amount'>;

/** Tope por medio: lo pagado por él menos lo ya devuelto (en efectivo, lo **aplicado**, no lo recibido). */
export function refundCaps(payments: PaymentCap[]): Map<PaymentMethod, string> {
  const caps = new Map<PaymentMethod, string>();
  for (const payment of payments) {
    const cap = moneyToCents(payment.amount) - moneyToCents(payment.refunded_amount);
    caps.set(payment.method, centsToMoney(cap < 0n ? 0n : cap));
  }
  return caps;
}

/**
 * Propuesta de reparto del valor entre los medios con que se pagó, en el orden de los pagos y sin pasar el tope de
 * cada uno. El usuario puede editarla. Si los topes no alcanzan, el resto queda sin asignar (el chequeo lo avisa).
 */
export function suggestRefunds(total: string, payments: PaymentCap[]): Map<PaymentMethod, string> {
  const caps = refundCaps(payments);
  let remaining = moneyToCents(total);
  const out = new Map<PaymentMethod, string>();
  for (const payment of payments) {
    if (remaining <= 0n) break;
    const cap = moneyToCents(caps.get(payment.method) ?? '0');
    const take = cap < remaining ? cap : remaining;
    if (take > 0n) out.set(payment.method, centsToMoney(take));
    remaining -= take;
  }
  return out;
}

export type RefundCheck = { ok: true; refunds: { method: PaymentMethod; amount: string }[] } | { ok: false; error: string };

const AMOUNT_RE = /^\d+(?:\.\d{1,2})?$/;

/**
 * Chequea los reembolsos escritos (`''` = ese medio no se usa): cada uno mayor que cero, con 2 decimales como
 * máximo y sin pasar el tope de su medio; y juntos suman exactamente el valor de la devolución.
 */
export function checkRefunds(total: string, payments: PaymentCap[], entered: Partial<Record<PaymentMethod, string>>): RefundCheck {
  const caps = refundCaps(payments);
  const refunds: { method: PaymentMethod; amount: string }[] = [];
  let sum = 0n;
  for (const [method, raw] of Object.entries(entered) as [PaymentMethod, string][]) {
    const text = raw.trim();
    if (text === '') continue;
    if (!AMOUNT_RE.test(text) || moneyToCents(text) <= 0n) {
      return { ok: false, error: 'Cada reembolso debe ser mayor que cero y tener como máximo 2 decimales' };
    }
    const cents = moneyToCents(text);
    const cap = moneyToCents(caps.get(method) ?? '0');
    if (cents > cap) {
      return {
        ok: false,
        error: caps.has(method)
          ? `Por ${method} se pueden devolver como máximo ${centsToMoney(cap)}`
          : `La venta no se pagó con ${method}: no se puede devolver por ese medio`,
      };
    }
    sum += cents;
    refunds.push({ method, amount: centsToMoney(cents) });
  }
  if (refunds.length === 0) return { ok: false, error: 'Indica por qué medio se devuelve el dinero' };
  const totalCents = moneyToCents(total);
  if (sum !== totalCents) {
    return {
      ok: false,
      error: `Los reembolsos suman ${centsToMoney(sum)} y el valor de la devolución es ${centsToMoney(totalCents)}: deben coincidir`,
    };
  }
  return { ok: true, refunds };
}

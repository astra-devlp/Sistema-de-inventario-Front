import { parseMoney } from '@core/money/money';
import { centsToMoney, moneyToCents } from '@features/sales/sale-math';
import { CustomerPaymentBody, PaymentMethodForCredit } from './customer-account.model';

export type PaymentCheck = { ok: true; body: CustomerPaymentBody } | { ok: false; error: string };

/**
 * Arma el cuerpo de un abono con las mismas reglas del back: monto > 0 con 2 decimales que no supere el saldo;
 * en efectivo, lo recibido cubre el abono; los demás medios no llevan recibido. El saldo vigente lo vuelve a
 * verificar el back con el cliente bloqueado.
 */
export function checkPayment(
  method: PaymentMethodForCredit,
  rawAmount: string,
  rawReceived: string,
  balance: string,
  note = '',
): PaymentCheck {
  const amount = parseMoney(rawAmount);
  if (!amount.ok) return { ok: false, error: `Abono: ${amount.error}` };
  if (moneyToCents(amount.value) <= 0n) return { ok: false, error: 'El abono debe ser mayor que cero' };
  if (moneyToCents(amount.value) > moneyToCents(balance)) {
    return { ok: false, error: `El abono supera el saldo del cliente (${centsToMoney(moneyToCents(balance))})` };
  }
  const body: CustomerPaymentBody = { method, amount: amount.value };
  if (method === 'efectivo') {
    const received = rawReceived.trim() ? parseMoney(rawReceived) : amount;
    if (!received.ok) return { ok: false, error: `Recibido: ${received.error}` };
    if (moneyToCents(received.value) < moneyToCents(amount.value)) {
      return { ok: false, error: 'En efectivo, lo recibido debe cubrir el abono' };
    }
    body.received = received.value;
  }
  if (note.trim()) body.note = note.trim();
  return { ok: true, body };
}

/** Huella de un abono para reutilizar la clave de idempotencia solo si el contenido es el mismo. */
export function paymentFingerprint(customerId: number, body: CustomerPaymentBody): string {
  return JSON.stringify([customerId, body.method, body.amount, body.received ?? null]);
}

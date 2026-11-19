import { HttpErrorResponse } from '@angular/common/http';
import { PaymentMethod } from './sale-math';
import { SaleCreatePayload } from './sale.model';

const KEY = 'inventario.pendingCharge';
const METHODS: PaymentMethod[] = ['efectivo', 'tarjeta', 'transferencia'];

/**
 * Cobro enviado cuyo resultado no se conoce (se cayó la red o el servidor respondió 5xx). Guarda lo mismo que viajó:
 * la clave de idempotencia y el cuerpo. Nunca credenciales. Vive en `sessionStorage`, como el token, y es de un
 * usuario: otro usuario en la misma pestaña no lo ve.
 */
export interface PendingCharge extends SaleCreatePayload {
  user_id: number;
  saved_at: string;
}

/** Respuesta definitiva: la venta quedó creada (2xx) o el servidor la rechazó (4xx). Sin respuesta o 5xx no lo es. */
export function isDefinitiveError(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status >= 400 && error.status < 500;
}

function isPending(value: unknown): value is PendingCharge {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v['idempotency_key'] === 'string' &&
    typeof v['user_id'] === 'number' &&
    typeof v['saved_at'] === 'string' &&
    (v['customer_id'] === null || typeof v['customer_id'] === 'number') &&
    Array.isArray(v['items']) &&
    v['items'].length > 0 &&
    v['items'].every((i) => typeof i?.product_id === 'number' && typeof i?.quantity === 'string') &&
    Array.isArray(v['payments']) &&
    v['payments'].length > 0 &&
    v['payments'].every((p) => METHODS.includes(p?.method) && typeof p?.amount === 'string')
  );
}

/** Guarda solo los campos conocidos: lo que no sea parte del cuerpo de la venta no llega al almacenamiento. */
export function savePendingCharge(payload: SaleCreatePayload, userId: number, now: Date = new Date()): void {
  const record: PendingCharge = {
    idempotency_key: payload.idempotency_key,
    items: payload.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
    payments: payload.payments.map((p) =>
      p.reference ? { method: p.method, amount: p.amount, reference: p.reference } : { method: p.method, amount: p.amount },
    ),
    customer_id: payload.customer_id,
    user_id: userId,
    saved_at: now.toISOString(),
  };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Almacenamiento bloqueado: el cobro sigue, pero sin red de seguridad tras una recarga.
  }
}

/** El cobro pendiente de este usuario, o `null` (también si lo guardado está dañado o es de otro usuario). */
export function loadPendingCharge(userId: number): PendingCharge | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isPending(parsed) && parsed.user_id === userId ? parsed : null;
  } catch {
    return null;
  }
}

export function clearPendingCharge(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // Nada que borrar.
  }
}

/** El cuerpo tal como se envía: sin los campos propios del almacenamiento. */
export function pendingPayload(pending: PendingCharge): SaleCreatePayload {
  return {
    idempotency_key: pending.idempotency_key,
    items: pending.items,
    payments: pending.payments,
    customer_id: pending.customer_id,
  };
}

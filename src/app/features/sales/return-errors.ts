import { HttpErrorResponse } from '@angular/common/http';
import { apiRowErrors } from '@core/api/api-error';
import { authErrorKind } from './authorization';

export type ReturnErrorKind =
  | 'auth_required'
  | 'auth_invalid'
  | 'rate_limited'
  /** 409 «No tienes un turno abierto…»: hay que abrir turno en una caja de la sede de la venta. */
  | 'no_shift'
  /** 409: el turno de quien devuelve es de otra sede. */
  | 'other_location'
  | 'voided'
  | 'key_reused'
  /** 409 con renglones: se supera lo vendido. */
  | 'excess'
  /** 409: se supera lo pagado por un medio (p. ej. efectivo por lo pagado con tarjeta). */
  | 'refund_cap'
  /** 422 con renglones: no pertenece a la venta o cantidad inválida. */
  | 'rows'
  /** 422 de texto: los reembolsos no suman el valor de la devolución. */
  | 'refund_sum'
  | 'other';

function text(error: HttpErrorResponse): string {
  const detail = error.error?.detail;
  return typeof detail === 'string' ? detail.toLowerCase() : '';
}

/** Clasifica el error de `POST /sales/{id}/returns` para decidir qué mostrar y qué hacer. */
export function returnErrorKind(error: unknown): ReturnErrorKind {
  if (!(error instanceof HttpErrorResponse)) return 'other';
  const auth = authErrorKind(error);
  if (auth === 'required') return 'auth_required';
  if (auth === 'invalid') return 'auth_invalid';
  if (auth === 'rate_limited') return 'rate_limited';
  const rows = apiRowErrors(error).length > 0;
  const detail = text(error);
  if (error.status === 409) {
    if (rows) return 'excess';
    if (detail.includes('turno abierto')) return 'no_shift';
    if (detail.includes('caja de la sede')) return 'other_location';
    if (detail.includes('está anulada')) return 'voided';
    if (detail.includes('clave de idempotencia')) return 'key_reused';
    if (detail.includes('se pueden devolver como máximo')) return 'refund_cap';
    return 'other';
  }
  if (error.status === 422) {
    if (rows) return 'rows';
    if (detail.includes('reembolsos suman')) return 'refund_sum';
  }
  return 'other';
}

/** Error de cada renglón enviado, por su posición en `items` (el índice de la API empieza en 0). */
export function returnRowErrors(error: unknown): Map<number, string> {
  const rows = new Map<number, string>();
  for (const row of apiRowErrors(error)) {
    if (!Number.isInteger(row.index) || !row.reason) continue;
    const previous = rows.get(row.index);
    rows.set(row.index, previous ? `${previous}. ${row.reason}` : row.reason);
  }
  return rows;
}

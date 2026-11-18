import { HttpErrorResponse } from '@angular/common/http';
import { apiRowErrors, httpErrorMessage } from '@core/api/api-error';
import { formatQuantity } from '../stock/quantity';

export type SaleErrorKind =
  /** 409 «No tienes un turno abierto»: hay que abrir turno. */
  | 'no_shift'
  /** 409 de la clave de idempotencia ya usada en otra venta (otro contenido u otro usuario). */
  | 'key_reused'
  /** 409 con renglones: solo falla el stock. */
  | 'stock'
  /** 422 con renglones: producto inactivo, sin precio, cantidad inválida o no encontrado. */
  | 'rows'
  /** 422 de texto: pagos que no cuadran o total cero. */
  | 'payments'
  /** 404 (p. ej. cliente que no existe) y cualquier otro. */
  | 'other';

function detailText(error: HttpErrorResponse): string {
  const detail = error.error?.detail;
  return typeof detail === 'string' ? detail.toLowerCase() : '';
}

/** Clasifica el error de `POST /sales` para decidir qué mostrar y qué hacer. */
export function saleErrorKind(error: unknown): SaleErrorKind {
  if (!(error instanceof HttpErrorResponse)) return 'other';
  const hasRows = apiRowErrors(error).length > 0;
  if (error.status === 409) {
    if (hasRows) return 'stock';
    const text = detailText(error);
    if (text.includes('turno abierto')) return 'no_shift';
    if (text.includes('clave') || text.includes('idempot')) return 'key_reused';
    return 'other';
  }
  if (error.status === 422) {
    if (hasRows) return 'rows';
    return typeof error.error?.detail === 'string' ? 'payments' : 'other';
  }
  return 'other';
}

/** `true` si repetir la misma petición con la misma clave es lo correcto: sin respuesta (red) o error del servidor. */
export function isRetryableWithSameKey(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}

/** Error de un renglón del carrito, por la posición del renglón en `items` (el índice de la API empieza en 0). */
export function saleRowErrors(error: unknown): Map<number, string> {
  const rows = new Map<number, string>();
  for (const row of apiRowErrors(error)) {
    if (!Number.isInteger(row.index) || !row.reason) continue;
    const reason =
      row.code === 'stock_insuficiente' && row.requested !== undefined && row.available !== undefined
        ? `Stock insuficiente: pides ${formatQuantity(row.requested)} y hay ${formatQuantity(row.available)}`
        : row.reason;
    const previous = rows.get(row.index);
    rows.set(row.index, previous ? `${previous}. ${reason}` : reason);
  }
  return rows;
}

/** Mensaje general de un error de venta (el de renglones se muestra además en cada renglón). */
export function saleErrorMessage(error: unknown, fallback = 'No se pudo registrar la venta'): string {
  return httpErrorMessage(error, fallback);
}

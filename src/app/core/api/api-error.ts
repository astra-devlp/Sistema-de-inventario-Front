import { HttpErrorResponse } from '@angular/common/http';

/** Error de un renglón (venta, devolución, inventario inicial). `index` empieza en 0: súmale 1 para mostrarlo. */
export interface ApiRowError {
  index: number;
  reason: string;
  code?: string;
  productId?: number;
  saleLineId?: number;
  requested?: string;
  available?: string;
}

/** `detail.code` del 403 que la API devuelve con el plan de la empresa vencido. */
export const PLAN_EXPIRED_CODE = 'plan_vencido';

function detailOf(error: unknown): unknown {
  return error instanceof HttpErrorResponse ? error.error?.detail : undefined;
}

/** 403 de plan vencido: no es sesión vencida, la sesión sigue siendo válida. */
export function isPlanExpired(error: unknown): boolean {
  if (!(error instanceof HttpErrorResponse) || error.status !== 403) return false;
  const detail = detailOf(error);
  return typeof detail === 'object' && detail !== null && (detail as { code?: unknown }).code === PLAN_EXPIRED_CODE;
}

/** Segundos que pide esperar la cabecera `Retry-After` (429 de autorización), o `null` si no vino o no es válida. */
export function retryAfterSeconds(error: unknown): number | null {
  if (!(error instanceof HttpErrorResponse)) return null;
  const raw = error.headers?.get('Retry-After')?.trim();
  if (!raw || !/^\d+$/.test(raw)) return null;
  return Number(raw);
}

/** Errores por renglón de `detail.errors[]` (409 de stock, 422 de venta, devolución o inventario inicial). */
export function apiRowErrors(error: unknown): ApiRowError[] {
  const detail = detailOf(error);
  const errors = typeof detail === 'object' && detail !== null ? (detail as { errors?: unknown }).errors : undefined;
  if (!Array.isArray(errors)) return [];
  return errors
    .filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null)
    .map((item) => ({
      index: Number(item['index']),
      reason: typeof item['reason'] === 'string' ? item['reason'] : '',
      code: typeof item['code'] === 'string' ? item['code'] : undefined,
      productId: typeof item['product_id'] === 'number' ? item['product_id'] : undefined,
      saleLineId: typeof item['sale_line_id'] === 'number' ? item['sale_line_id'] : undefined,
      requested: item['requested'] != null ? String(item['requested']) : undefined,
      available: item['available'] != null ? String(item['available']) : undefined,
    }));
}

/** Texto para mostrar al usuario. El `detail` de la API se muestra tal cual; el resto cae al `fallback`. */
export function httpErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) return fallback;

  // Sin respuesta: la API está apagada, no es alcanzable o rechazó el origen (CORS).
  if (error.status === 0) {
    return `${fallback}. No hay conexión con el servidor; revisa tu conexión o que el backend esté encendido`;
  }

  const detail = detailOf(error);
  if (typeof detail === 'string' && detail.trim()) return detail;
  // Objeto con `message`: plan vencido y errores por renglón («… no se guardó nada»).
  if (typeof detail === 'object' && detail !== null && !Array.isArray(detail)) {
    const message = (detail as { message?: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  // FastAPI devuelve los errores de validación (422) como una lista de { loc, msg }.
  if (Array.isArray(detail) && detail.length) {
    const fields = detail
      .map((item) => (Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null))
      .filter((field): field is string => typeof field === 'string');
    if (fields.length) return `${fallback}. Revisa: ${[...new Set(fields)].join(', ')}`;
  }

  if (error.status === 401) return `${fallback}. Sesión vencida o inválida: cierra sesión y vuelve a entrar`;
  if (error.status === 403) return `${fallback}. No tienes permiso para esta operación`;
  if (error.status === 429) return `${fallback}. Demasiados intentos: espera unos minutos`;
  if (error.status >= 500) return `${fallback}. Error del servidor (${error.status})`;
  return fallback;
}

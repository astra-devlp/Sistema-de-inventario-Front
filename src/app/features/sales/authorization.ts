import { HttpErrorResponse } from '@angular/common/http';
import type { UserRole } from '@core/auth/auth.model';
import { retryAfterSeconds } from '@core/api/api-error';

export type AuthAction = 'void' | 'return';

export interface AuthPlan {
  /** Pedir las credenciales de entrada (sin intentar antes la operación desde la sesión). */
  askUpFront: boolean;
  /** Quién puede autorizar: un Supervisor de la sede o un Administrador, o solo un Administrador. */
  who: 'supervisor' | 'administrador';
  /** Aviso para mostrar antes de pedir credenciales. */
  notice: string | null;
}

export const WINDOW_EXPIRED_NOTICE = 'El plazo de devolución de esta venta venció: solo autoriza un Administrador.';

/**
 * Cuándo se pide el diálogo de credenciales y a quién:
 * - Usuario (Cajero): siempre, de entrada.
 * - Supervisor o Administrador: primero se intenta sin credenciales y solo si el API pide la autorización de un
 *   supervisor se abre el diálogo.
 * - Devolución con el plazo vencido: solo autoriza un Administrador. Un Administrador se autoriza solo (se intenta
 *   sin credenciales); un Supervisor debe traer las de un Administrador, así que se piden de entrada.
 */
export function authorizationPlan(role: UserRole | null | undefined, action: AuthAction, windowExpired: boolean): AuthPlan {
  const adminOnly = action === 'return' && windowExpired;
  return {
    askUpFront: role === 'Usuario' || (adminOnly && role === 'Supervisor'),
    who: adminOnly ? 'administrador' : 'supervisor',
    notice: adminOnly ? WINDOW_EXPIRED_NOTICE : null,
  };
}

export type AuthErrorKind =
  /** 403 «Esta operación requiere la autorización de un supervisor»: falta el diálogo. */
  | 'required'
  /** 403 «Autorización no válida»: un solo mensaje para todo rechazo; no se adivina el motivo. */
  | 'invalid'
  /** 429: demasiados intentos; `Retry-After` dice cuánto esperar. */
  | 'rate_limited'
  | 'none';

function lowerDetail(error: HttpErrorResponse): string {
  const detail = error.error?.detail;
  return typeof detail === 'string' ? detail.toLowerCase() : '';
}

/** Clasifica un error de autorización. Ninguno de estos cierra la sesión: solo el 401 lo hace. */
export function authErrorKind(error: unknown): AuthErrorKind {
  if (!(error instanceof HttpErrorResponse)) return 'none';
  if (error.status === 429) return 'rate_limited';
  if (error.status !== 403) return 'none';
  const text = lowerDetail(error);
  if (text.includes('requiere la autorización')) return 'required';
  if (text.includes('autorización no válida')) return 'invalid';
  return 'none';
}

/** Segundos de espera de un 429: la cabecera `Retry-After`, o 60 si no vino. */
export function lockSeconds(error: unknown): number {
  const seconds = retryAfterSeconds(error);
  return seconds !== null && seconds > 0 ? seconds : 60;
}

/** Segundos que faltan para `until` (marca de tiempo en ms), sin bajar de cero. */
export function remainingSeconds(until: number, now: number): number {
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/** `65` → `"1:05"`. */
export function formatCountdown(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, '0')}`;
}

// ---- anulación ----

export type VoidConflict = 'already_voided' | 'shift_closed' | 'has_returns' | 'other';

/** Los tres 409 distintos de anular. El texto de la API se muestra tal cual; esto solo los distingue. */
export function voidConflictKind(error: unknown): VoidConflict {
  if (!(error instanceof HttpErrorResponse) || error.status !== 409) return 'other';
  const text = lowerDetail(error);
  if (text.includes('ya está anulada')) return 'already_voided';
  if (text.includes('turno de esta venta ya está cerrado')) return 'shift_closed';
  if (text.includes('ya tiene devoluciones')) return 'has_returns';
  return 'other';
}

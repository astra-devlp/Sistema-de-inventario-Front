import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage, retryAfterSeconds } from '@core/api/api-error';

export const MIN_PASSWORD = 8;
export const MAX_PASSWORD = 128;

/** Valida el cambio de la propia contraseña con las reglas del back (8 a 128, distinta de la actual). */
export function newPasswordError(current: string, next: string, confirm: string): string | null {
  if (!current) return 'Escribe tu contraseña actual';
  if (next.length < MIN_PASSWORD) return `La contraseña nueva debe tener al menos ${MIN_PASSWORD} caracteres`;
  if (next.length > MAX_PASSWORD) return `La contraseña nueva admite como máximo ${MAX_PASSWORD} caracteres`;
  if (next === current) return 'La contraseña nueva debe ser distinta de la actual';
  if (next !== confirm) return 'La confirmación no coincide con la contraseña nueva';
  return null;
}

/** "en 3 minutos" / "en unos segundos", a partir de los segundos de `Retry-After`. */
export function waitLabel(seconds: number | null): string {
  if (seconds === null) return 'en unos minutos';
  if (seconds < 60) return 'en unos segundos';
  const minutes = Math.ceil(seconds / 60);
  return `en ${minutes} minuto${minutes === 1 ? '' : 's'}`;
}

/** Mensaje del 429 del login y del cambio de contraseña: el correo quedó bloqueado por intentos fallidos. */
export function lockedMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse && error.status === 429) {
    return `Demasiados intentos fallidos con este correo. Intenta de nuevo ${waitLabel(retryAfterSeconds(error))}.`;
  }
  return httpErrorMessage(error, fallback);
}

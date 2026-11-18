import { AuthUser } from '@core/auth/auth.model';

/** Mismas reglas que `cash_register_rules.py` del back: el código es el prefijo del recibo (`C1-0001`). */
export const CASH_CODE_MAX_LENGTH = 10;
export const CASH_CODE_PATTERN = /^[A-Za-z0-9-]+$/;

export const CASH_CODE_ERROR = `El código de la caja solo admite letras, números y guion, con un máximo de ${CASH_CODE_MAX_LENGTH} caracteres`;

export type CashCodeResult = { ok: true; code: string } | { ok: false; error: string };

/** Recorta y pasa a mayúsculas, como el back; la API sigue siendo quien decide si el código ya existe. */
export function normalizeCashCode(raw: string): CashCodeResult {
  const code = raw.trim().toUpperCase();
  if (!code || code.length > CASH_CODE_MAX_LENGTH || !CASH_CODE_PATTERN.test(code)) {
    return { ok: false, error: CASH_CODE_ERROR };
  }
  return { ok: true, code };
}

/** Plazo de devolución en días calendario (`PATCH /companies/me`: 0 a 365, entero). */
export function validReturnWindow(days: number | null): boolean {
  return days !== null && Number.isInteger(days) && days >= 0 && days <= 365;
}

export const NO_LOCATION_MESSAGE = 'Pide a tu administrador que te asigne una sede.';

/** El Administrador opera todas las sedes sin asignación; Supervisor y Cajero solo las asignadas. */
export function needsLocationAssignment(user: Pick<AuthUser, 'role'> | null, locationIds: number[]): boolean {
  if (!user || user.role === 'Administrador' || user.role === 'Administrador de plataforma') return false;
  return locationIds.length === 0;
}

/** Cambia una sede dentro de la lista completa que reemplaza `PUT /users/{id}/locations`. */
export function toggleLocation(ids: number[], id: number, checked: boolean): number[] {
  const rest = ids.filter((current) => current !== id);
  return checked ? [...rest, id].sort((a, b) => a - b) : rest;
}

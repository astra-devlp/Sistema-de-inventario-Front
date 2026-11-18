import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage, isConflict } from '@core/api/api-error';
import { absMoney, formatCop, isNegativeMoney, isZeroMoney } from '@core/money/money';

/** Por qué la API rechazó abrir el turno (409): son mensajes distintos y piden acciones distintas. */
export type OpenConflictKind = 'register_busy' | 'user_busy' | 'inactive' | 'other';

export interface OpenConflict {
  kind: OpenConflictKind;
  message: string;
}

/**
 * Clasifica el 409 de `POST /cash-shifts` por el texto del back (`shift_rules.py`): «La caja ya tiene un turno
 * abierto…» (otra persona la está usando) frente a «Ya tienes un turno abierto…» (el usuario ya tiene uno).
 * Devuelve `null` si no es un 409.
 */
export function openShiftConflict(error: unknown): OpenConflict | null {
  if (!isConflict(error)) return null;
  const message = httpErrorMessage(error, 'No se pudo abrir el turno');
  const text = message.toLowerCase();
  if (text.includes('ya tienes un turno abierto')) return { kind: 'user_busy', message };
  if (text.includes('la caja ya tiene un turno abierto')) return { kind: 'register_busy', message };
  if (text.includes('inactiva')) return { kind: 'inactive', message };
  return { kind: 'other', message };
}

/** 404 de `GET /cash-shifts/current`: el usuario no tiene turno abierto. Es normal, no un error. */
export function isNoCurrentShift(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

export type DifferenceKind = 'sobrante' | 'faltante' | 'exacto';

export interface DifferenceInfo {
  kind: DifferenceKind;
  /** «Sobrante», «Faltante» o «Cuadre exacto». */
  label: string;
  /** Monto sin signo: el rótulo ya dice si sobra o falta. */
  amount: string;
  /** Monto con su signo (`+$ 500`, `-$ 500`) para mostrarlo junto al rótulo. */
  signed: string;
}

/** Contado − esperado: positivo sobra, negativo falta. La API la entrega calculada; aquí solo se rotula. */
export function differenceInfo(difference: string | null | undefined): DifferenceInfo | null {
  if (difference === null || difference === undefined || difference === '') return null;
  if (isZeroMoney(difference)) return { kind: 'exacto', label: 'Cuadre exacto', amount: formatCop('0'), signed: formatCop('0') };
  if (isNegativeMoney(difference)) {
    return { kind: 'faltante', label: 'Faltante', amount: formatCop(absMoney(difference)), signed: formatCop(difference) };
  }
  return { kind: 'sobrante', label: 'Sobrante', amount: formatCop(difference), signed: `+${formatCop(difference)}` };
}

/** El esperado negativo es válido: se devolvió más efectivo del que entró. Se muestra con su signo, sin error. */
export function expectedNote(expected: string | null | undefined): string | null {
  return isNegativeMoney(expected)
    ? 'El efectivo esperado es negativo: se devolvió más efectivo del que entró en el turno.'
    : null;
}

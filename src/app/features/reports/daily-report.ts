import { HttpErrorResponse } from '@angular/common/http';
import { isPlanExpired } from '@core/api/api-error';
import {
  DailyReport,
  Flow,
  MethodAmounts,
  Net,
  RegisterReport,
  ReportSection,
  ShiftReport,
} from './daily-report.model';

export const METHOD_LABELS: Record<keyof MethodAmounts, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
};

export const METHODS: (keyof MethodAmounts)[] = ['efectivo', 'tarjeta', 'transferencia'];

export const OPEN_SHIFT_LABEL = 'Turno abierto';
export const FULL_SHIFT_NOTE = 'Del turno completo, no solo de este día.';

export const CLOSED_DIFFERENCE_NOTE =
  'Es la suma de las diferencias de los turnos que cerraron este día. Puede no coincidir con la suma de los turnos de la lista, porque un turno puede cerrarse otro día.';

export const MIDNIGHT_NOTE =
  'Un turno que cruza la medianoche aparece en los dos días, cada uno con su parte. El esperado, lo contado y la diferencia son del turno completo.';

export const CASH_NET_NOTE = 'El neto en efectivo es el movimiento de caja del día.';

const MONEY_RE = /^(-?)(\d+)(?:\.(\d+))?$/;
const ZERO = '0.00';

/**
 * Normaliza un monto del informe a texto con 2 decimales y signo: `"0"` y `"0.00"` dan `"0.00"`, `"-1500.5"` da
 * `"-1500.50"`. Devuelve `null` si no es un decimal (el back manda hasta 2 decimales). Nunca pasa por `number`.
 */
export function normalizeReportMoney(raw: unknown): string | null {
  if (typeof raw === 'number') raw = String(raw);
  if (typeof raw !== 'string') return null;
  const match = MONEY_RE.exec(raw.trim());
  if (!match) return null;
  const [, sign, intRaw, fracRaw = ''] = match;
  if (fracRaw.length > 2 && /[1-9]/.test(fracRaw.slice(2))) return null;
  const int = intRaw.replace(/^0+(?=\d)/, '');
  const frac = fracRaw.slice(0, 2).padEnd(2, '0');
  const zero = !/[1-9]/.test(int + frac);
  return `${sign && !zero ? '-' : ''}${int}.${frac}`;
}

function money(raw: unknown): string {
  return normalizeReportMoney(raw) ?? ZERO;
}

function nullableMoney(raw: unknown): string | null {
  return raw === null || raw === undefined ? null : money(raw);
}

function methods(raw: Partial<Record<keyof MethodAmounts, unknown>> | undefined): MethodAmounts {
  return { efectivo: money(raw?.efectivo), tarjeta: money(raw?.tarjeta), transferencia: money(raw?.transferencia) };
}

function count(raw: unknown): number {
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0;
}

function flow(raw: Partial<Flow> | undefined): Flow {
  return { count: count(raw?.count), total: money(raw?.total), by_method: methods(raw?.by_method) };
}

function net(raw: Partial<Net> | undefined): Net {
  return { total: money(raw?.total), by_method: methods(raw?.by_method) };
}

function section(raw: Partial<ReportSection>): ReportSection {
  return { sales: flow(raw.sales), voids: flow(raw.voids), returns: flow(raw.returns), net: net(raw.net) };
}

function register(raw: RegisterReport): RegisterReport {
  return { ...section(raw), cash_register_id: raw.cash_register_id, code: raw.code, name: raw.name };
}

function shift(raw: ShiftReport): ShiftReport {
  return {
    ...section(raw),
    shift_id: raw.shift_id,
    cash_register_id: raw.cash_register_id,
    register_code: raw.register_code,
    user_id: raw.user_id,
    user_name: raw.user_name,
    status: raw.status,
    opened_at: raw.opened_at,
    closed_at: raw.closed_at ?? null,
    closed_by_user_id: raw.closed_by_user_id ?? null,
    forced_close: raw.forced_close === true,
    crosses_midnight: raw.crosses_midnight === true,
    opening_cash: money(raw.opening_cash),
    expected_cash: nullableMoney(raw.expected_cash),
    counted_cash: nullableMoney(raw.counted_cash),
    difference: nullableMoney(raw.difference),
  };
}

/** Respuesta de la API a un informe con todos los montos normalizados y las listas siempre presentes. */
export function mapDailyReport(raw: DailyReport): DailyReport {
  return {
    ...section(raw),
    location_id: raw.location_id,
    location_name: raw.location_name,
    date: raw.date,
    timezone: raw.timezone,
    closed_shifts_count: count(raw.closed_shifts_count),
    closed_shifts_difference: money(raw.closed_shifts_difference),
    registers: (raw.registers ?? []).map(register),
    shifts: (raw.shifts ?? []).map(shift),
  };
}

/** Hoy en Bogotá (`YYYY-MM-DD`). Colombia no tiene horario de verano: UTC−5 todo el año. */
export function bogotaToday(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** `YYYY-MM-DD` válido como fecha de calendario. */
export function isValidReportDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Día sin movimientos: todo en cero. Se muestra con ceros, no como error. */
export function isEmptyDay(report: DailyReport): boolean {
  return (
    report.sales.count === 0 &&
    report.voids.count === 0 &&
    report.returns.count === 0 &&
    report.registers.length === 0 &&
    report.shifts.length === 0
  );
}

export function isOpenShift(shift: Pick<ShiftReport, 'status'>): boolean {
  return shift.status === 'abierto';
}

/** Estado del turno para la tabla: abierto, cerrado o cerrado por otra persona (forzado). */
export function shiftStateLabel(shift: Pick<ShiftReport, 'status' | 'forced_close'>): string {
  if (isOpenShift(shift)) return 'Abierto';
  return shift.forced_close ? 'Cerrado (forzado)' : 'Cerrado';
}

/** Esperado, contado o diferencia: `null` solo mientras el turno está abierto. */
export function shiftCashLabel(value: string | null): string | null {
  return value === null ? OPEN_SHIFT_LABEL : null;
}

/** Diferencia con su sentido: positivo sobra, negativo falta. */
export function differenceLabel(value: string | null): string | null {
  if (value === null) return null;
  if (!/[1-9]/.test(value)) return 'Cuadra';
  return value.startsWith('-') ? 'Falta' : 'Sobra';
}

export type ReportErrorKind = 'forbidden' | 'not_found' | 'invalid' | 'other';

/**
 * Qué falló al pedir el informe. Ninguno cierra la sesión (solo el 401 lo hace): el 403 del Cajero y el 404 de una
 * sede ajena se muestran donde ocurrieron. El 403 del plan vencido lo maneja el interceptor.
 */
export function reportErrorKind(error: unknown): ReportErrorKind {
  if (!(error instanceof HttpErrorResponse) || isPlanExpired(error)) return 'other';
  if (error.status === 403) return 'forbidden';
  if (error.status === 404) return 'not_found';
  if (error.status === 422) return 'invalid';
  return 'other';
}

export const REPORT_ERRORS: Record<Exclude<ReportErrorKind, 'other'>, string> = {
  forbidden: 'Tu rol no puede consultar el informe diario.',
  not_found: 'Esa sede no existe o no la tienes asignada: elige una de tu lista.',
  invalid: 'La fecha o la sede no son válidas.',
};

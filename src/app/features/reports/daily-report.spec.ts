import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { formatCop } from '@core/money/money';
import {
  CLOSED_DIFFERENCE_NOTE,
  FULL_SHIFT_NOTE,
  MIDNIGHT_NOTE,
  OPEN_SHIFT_LABEL,
  bogotaToday,
  differenceLabel,
  isEmptyDay,
  isValidReportDate,
  mapDailyReport,
  normalizeReportMoney,
  reportErrorKind,
  shiftCashLabel,
  shiftStateLabel,
} from './daily-report';
import { DailyReport, ShiftReport } from './daily-report.model';

const zeros = { efectivo: '0', tarjeta: '0', transferencia: '0' };
const flow = { count: 0, total: '0', by_method: zeros };

function report(overrides: Partial<DailyReport> = {}): DailyReport {
  return {
    sales: flow,
    voids: flow,
    returns: flow,
    net: { total: '0', by_method: zeros },
    location_id: 2,
    location_name: 'Principal',
    date: '2026-11-18',
    timezone: 'America/Bogota',
    closed_shifts_count: 0,
    closed_shifts_difference: '0',
    registers: [],
    shifts: [],
    ...overrides,
  };
}

function shift(overrides: Partial<ShiftReport> = {}): ShiftReport {
  return {
    sales: flow,
    voids: flow,
    returns: flow,
    net: { total: '0', by_method: zeros },
    shift_id: 1,
    cash_register_id: 1,
    register_code: 'C1',
    user_id: 3,
    user_name: 'Carla Cajera',
    status: 'cerrado',
    opened_at: '2026-11-18T13:00:00Z',
    closed_at: '2026-11-18T22:00:00Z',
    closed_by_user_id: 3,
    forced_close: false,
    crosses_midnight: false,
    opening_cash: '50000.00',
    expected_cash: '60000.00',
    counted_cash: '59000.00',
    difference: '-1000.00',
    ...overrides,
  };
}

describe('normalizeReportMoney', () => {
  it('acepta 0 y 0.00 y los deja iguales', () => {
    expect(normalizeReportMoney('0')).toBe('0.00');
    expect(normalizeReportMoney('0.00')).toBe('0.00');
    expect(normalizeReportMoney('0.0')).toBe('0.00');
  });

  it('completa los decimales y conserva el signo', () => {
    expect(normalizeReportMoney('50000')).toBe('50000.00');
    expect(normalizeReportMoney('-1500.5')).toBe('-1500.50');
    expect(normalizeReportMoney('7140.00')).toBe('7140.00');
  });

  it('un cero negativo no lleva signo', () => {
    expect(normalizeReportMoney('-0')).toBe('0.00');
    expect(normalizeReportMoney('-0.00')).toBe('0.00');
  });

  it('rechaza lo que no es un decimal o trae más de 2 decimales con valor', () => {
    expect(normalizeReportMoney('abc')).toBeNull();
    expect(normalizeReportMoney('')).toBeNull();
    expect(normalizeReportMoney(null)).toBeNull();
    expect(normalizeReportMoney('1.005')).toBeNull();
    expect(normalizeReportMoney('1.500')).toBe('1.50');
  });

  it('cantidades muy grandes no pierden dígitos (sin number)', () => {
    expect(normalizeReportMoney('9999999999.99')).toBe('9999999999.99');
  });
});

describe('formato de ceros', () => {
  it('0 y 0.00 se muestran igual', () => {
    expect(formatCop(normalizeReportMoney('0'))).toBe('$ 0');
    expect(formatCop(normalizeReportMoney('0.00'))).toBe('$ 0');
    expect(formatCop('0')).toBe('$ 0');
  });

  it('el neto negativo conserva el signo', () => {
    expect(formatCop(normalizeReportMoney('-3570'))).toBe('-$ 3.570');
  });
});

describe('mapDailyReport', () => {
  it('un día sin movimientos queda en ceros y es un día vacío, no un error', () => {
    const mapped = mapDailyReport(report());
    expect(mapped.sales.total).toBe('0.00');
    expect(mapped.net.by_method.efectivo).toBe('0.00');
    expect(mapped.closed_shifts_difference).toBe('0.00');
    expect(mapped.registers).toEqual([]);
    expect(isEmptyDay(mapped)).toBe(true);
  });

  it('normaliza los montos de la sede, por medio y neto', () => {
    const mapped = mapDailyReport(
      report({
        sales: { count: 2, total: '14280', by_method: { efectivo: '0', tarjeta: '14280.00', transferencia: '0' } },
        net: { total: '-3570.00', by_method: { efectivo: '-3570', tarjeta: '0.00', transferencia: '0' } },
      }),
    );
    expect(mapped.sales).toEqual({ count: 2, total: '14280.00', by_method: { efectivo: '0.00', tarjeta: '14280.00', transferencia: '0.00' } });
    expect(mapped.net.by_method.efectivo).toBe('-3570.00');
    expect(isEmptyDay(mapped)).toBe(false);
  });

  it('esperado, contado y diferencia siguen en null mientras el turno está abierto', () => {
    const open = shift({ status: 'abierto', closed_at: null, closed_by_user_id: null, expected_cash: null, counted_cash: null, difference: null });
    const [mapped] = mapDailyReport(report({ shifts: [open] })).shifts;
    expect(mapped.expected_cash).toBeNull();
    expect(mapped.counted_cash).toBeNull();
    expect(mapped.difference).toBeNull();
    expect(mapped.opening_cash).toBe('50000.00');
  });

  it('en un turno cerrado normaliza esperado, contado y diferencia, y conserva las banderas', () => {
    const closed = shift({ expected_cash: '60000', counted_cash: '59000', difference: '-1000', forced_close: true, crosses_midnight: true });
    const [mapped] = mapDailyReport(report({ shifts: [closed] })).shifts;
    expect([mapped.expected_cash, mapped.counted_cash, mapped.difference]).toEqual(['60000.00', '59000.00', '-1000.00']);
    expect(mapped.forced_close).toBe(true);
    expect(mapped.crosses_midnight).toBe(true);
  });

  it('closed_shifts_difference queda aparte, normalizado y con su cantidad', () => {
    const mapped = mapDailyReport(report({ closed_shifts_count: 2, closed_shifts_difference: '-1000' }));
    expect(mapped.closed_shifts_count).toBe(2);
    expect(mapped.closed_shifts_difference).toBe('-1000.00');
  });

  it('las cajas llevan sus propias secciones', () => {
    const mapped = mapDailyReport(
      report({
        registers: [{ cash_register_id: 1, code: 'C1', name: 'Caja 1', sales: { count: 1, total: '3570', by_method: { efectivo: '3570', tarjeta: '0', transferencia: '0' } }, voids: flow, returns: flow, net: { total: '3570', by_method: { efectivo: '3570', tarjeta: '0', transferencia: '0' } } }],
      }),
    );
    expect(mapped.registers[0].sales.by_method.efectivo).toBe('3570.00');
    expect(mapped.registers[0].code).toBe('C1');
  });
});

describe('rótulos', () => {
  it('estado del turno', () => {
    expect(shiftStateLabel({ status: 'abierto', forced_close: false })).toBe('Abierto');
    expect(shiftStateLabel({ status: 'cerrado', forced_close: false })).toBe('Cerrado');
    expect(shiftStateLabel({ status: 'cerrado', forced_close: true })).toBe('Cerrado (forzado)');
  });

  it('turno abierto solo cuando el valor es null', () => {
    expect(shiftCashLabel(null)).toBe(OPEN_SHIFT_LABEL);
    expect(OPEN_SHIFT_LABEL).toBe('Turno abierto');
    expect(shiftCashLabel('0.00')).toBeNull();
  });

  it('la diferencia dice si sobra, falta o cuadra', () => {
    expect(differenceLabel('500.00')).toBe('Sobra');
    expect(differenceLabel('-1000.00')).toBe('Falta');
    expect(differenceLabel('0.00')).toBe('Cuadra');
    expect(differenceLabel(null)).toBeNull();
  });

  it('las notas dicen lo que el back documenta', () => {
    expect(FULL_SHIFT_NOTE).toContain('turno completo');
    expect(CLOSED_DIFFERENCE_NOTE).toContain('cerraron este día');
    expect(CLOSED_DIFFERENCE_NOTE).toContain('Puede no coincidir');
    expect(MIDNIGHT_NOTE).toContain('dos días');
  });
});

describe('bogotaToday', () => {
  it('usa la fecha de Bogotá, no la de UTC', () => {
    expect(bogotaToday(new Date('2026-11-19T03:00:00Z'))).toBe('2026-11-18');
    expect(bogotaToday(new Date('2026-11-19T05:00:00Z'))).toBe('2026-11-19');
    expect(bogotaToday(new Date('2026-11-18T22:30:00Z'))).toBe('2026-11-18');
  });

  it('valida fechas de calendario', () => {
    expect(isValidReportDate('2026-11-18')).toBe(true);
    expect(isValidReportDate('2026-02-30')).toBe(false);
    expect(isValidReportDate('18/11/2026')).toBe(false);
  });
});

describe('reportErrorKind', () => {
  const http = (status: number, detail?: unknown) => new HttpErrorResponse({ status, error: detail === undefined ? null : { detail } });

  it('403 y 404 se distinguen y ninguno es un error genérico', () => {
    expect(reportErrorKind(http(403, 'No tienes permiso'))).toBe('forbidden');
    expect(reportErrorKind(http(404, 'Sede no encontrada'))).toBe('not_found');
    expect(reportErrorKind(http(422))).toBe('invalid');
  });

  it('el 403 de plan vencido no es del informe', () => {
    expect(reportErrorKind(http(403, { code: 'plan_vencido' }))).toBe('other');
  });

  it('fallo de red o 500 es otro', () => {
    expect(reportErrorKind(http(0))).toBe('other');
    expect(reportErrorKind(http(500))).toBe('other');
    expect(reportErrorKind(new Error('x'))).toBe('other');
  });
});

import { absMoney, formatCop, isNegativeMoney, isZeroMoney, parseMoney } from './money';

function value(raw: string): string {
  const result = parseMoney(raw);
  return result.ok ? result.value : `ERROR: ${result.error}`;
}

describe('parseMoney', () => {
  it('normaliza a 2 decimales', () => {
    expect(value('50000')).toBe('50000.00');
    expect(value(' 50000.5 ')).toBe('50000.50');
    expect(value('1500,25')).toBe('1500.25');
    expect(value('0')).toBe('0.00');
    expect(value('007.10')).toBe('7.10');
    expect(value('10.500')).toBe('10.50');
  });

  it('el cero es válido: se puede abrir o contar sin efectivo', () => {
    expect(value('0.00')).toBe('0.00');
  });

  it('rechaza vacío, negativos y más de 2 decimales', () => {
    expect(value('')).toBe('ERROR: Escribe el monto');
    expect(value('-1')).toBe('ERROR: El monto no puede ser negativo');
    expect(value('10.005')).toBe('ERROR: El monto admite como máximo 2 decimales');
  });

  it('no adivina separadores de miles: «50.000» tiene 3 decimales, no es cincuenta mil', () => {
    expect(value('50.001')).toBe('ERROR: El monto admite como máximo 2 decimales');
    expect(value('50,000.00')).toContain('ERROR: El monto no es un número válido');
    expect(value('1 000')).toContain('ERROR: El monto no es un número válido');
    expect(value('abc')).toContain('ERROR: El monto no es un número válido');
  });

  it('respeta el máximo de NUMERIC(12,2)', () => {
    expect(value('9999999999.99')).toBe('9999999999.99');
    expect(value('10000000000')).toBe('ERROR: El monto es demasiado grande');
  });

  it('no pierde precisión con montos que un number no representa', () => {
    expect(value('9007199254740993.00')).toBe('ERROR: El monto es demasiado grande');
    expect(value('1234567890.12')).toBe('1234567890.12');
  });
});

describe('formatCop y signos', () => {
  it('agrupa miles con punto y muestra centavos solo si los hay', () => {
    expect(formatCop('50000.00')).toBe('$ 50.000');
    expect(formatCop('1234567.50')).toBe('$ 1.234.567,50');
    expect(formatCop('0.00')).toBe('$ 0');
    expect(formatCop('999.9')).toBe('$ 999,90');
  });

  it('muestra el signo negativo y no lo trata como error', () => {
    expect(formatCop('-1500.50')).toBe('-$ 1.500,50');
    expect(formatCop('-20000.00')).toBe('-$ 20.000');
  });

  it('nulo o vacío es un guion, y un valor raro se deja tal cual', () => {
    expect(formatCop(null)).toBe('—');
    expect(formatCop('')).toBe('—');
    expect(formatCop('abc')).toBe('abc');
  });

  it('isNegativeMoney e isZeroMoney', () => {
    expect(isNegativeMoney('-0.01')).toBe(true);
    expect(isNegativeMoney('-0.00')).toBe(false);
    expect(isNegativeMoney('5.00')).toBe(false);
    expect(isZeroMoney('0.00')).toBe(true);
    expect(isZeroMoney('-0.00')).toBe(true);
    expect(isZeroMoney('0.01')).toBe(false);
    expect(absMoney('-500.00')).toBe('500.00');
  });
});

import { compareQuantity, formatQuantity, parseQuantity } from './quantity';

function value(raw: string, unit: Parameters<typeof parseQuantity>[1], allowZero = false): string {
  const result = parseQuantity(raw, unit, allowZero);
  return result.ok ? result.value : `ERROR: ${result.error}`;
}

describe('parseQuantity (mismos casos que quantity_error del back)', () => {
  it('acepta enteros y normaliza ceros', () => {
    expect(value('5', 'Cantidad')).toBe('5');
    expect(value(' 007 ', 'Cantidad')).toBe('7');
    expect(value('5.000', 'Cantidad')).toBe('5');
    expect(value('24', null)).toBe('24');
  });

  it('cero: solo vale en el conteo de un ajuste', () => {
    expect(value('0', 'Cantidad')).toBe('ERROR: La cantidad debe ser mayor que cero');
    expect(value('0.000', 'Peso')).toBe('ERROR: La cantidad debe ser mayor que cero');
    expect(value('0', 'Cantidad', true)).toBe('0');
  });

  it('negativos', () => {
    expect(value('-1', 'Cantidad')).toBe('ERROR: La cantidad debe ser mayor que cero');
    expect(value('-1', 'Cantidad', true)).toBe('ERROR: La cantidad debe ser mayor o igual a cero');
  });

  it('las unidades de tipo Cantidad no aceptan decimales', () => {
    const message = 'ERROR: El producto se maneja por unidades enteras: la cantidad no puede tener decimales';
    expect(value('1.5', 'Cantidad')).toBe(message);
    expect(value('2,5', 'Cantidad')).toBe(message);
  });

  it('peso, volumen y longitud aceptan hasta 3 decimales y con coma', () => {
    expect(value('1.5', 'Peso')).toBe('1.5');
    expect(value('2,25', 'Volumen')).toBe('2.25');
    expect(value('0.001', 'Longitud')).toBe('0.001');
    expect(value('1.500', 'Peso')).toBe('1.5');
    expect(value('1.0005', 'Peso')).toBe('ERROR: La cantidad admite como máximo 3 decimales');
  });

  it('el máximo es el de NUMERIC(12,3)', () => {
    expect(value('999999999.999', 'Peso')).toBe('999999999.999');
    expect(value('999999999.9990', 'Peso')).toBe('999999999.999');
    expect(value('1000000000', 'Peso')).toBe('ERROR: La cantidad no puede superar 999999999.999');
  });

  it('no es un número', () => {
    for (const raw of ['', 'abc', '1e3', '1.2.3', '.5', '5.', '1 000']) {
      expect(value(raw, 'Peso'), raw).toBe('ERROR: La cantidad no es un número válido');
    }
  });
});

describe('formatQuantity y compareQuantity', () => {
  it('quita los ceros de relleno que manda el back', () => {
    expect(formatQuantity('50.000')).toBe('50');
    expect(formatQuantity('12.500')).toBe('12.5');
    expect(formatQuantity('-3.000')).toBe('-3');
    expect(formatQuantity('0.000')).toBe('0');
    expect(formatQuantity(null)).toBe('—');
  });

  it('compara sin pasar por number', () => {
    expect(compareQuantity('0.1', '0.10')).toBe(0);
    expect(compareQuantity('999999999.999', '999999999.998')).toBe(1);
    expect(compareQuantity('2', '10')).toBe(-1);
  });
});

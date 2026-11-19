import {
  CASH_CODE_ERROR,
  CASH_CODE_MAX_LENGTH,
  needsLocationAssignment,
  normalizeCashCode,
  toggleLocation,
  validReturnWindow,
} from './location-rules';

describe('normalizeCashCode', () => {
  it('recorta y pasa a mayúsculas, como el back', () => {
    expect(normalizeCashCode('  c1 ')).toEqual({ ok: true, code: 'C1' });
    expect(normalizeCashCode('caja-2')).toEqual({ ok: true, code: 'CAJA-2' });
  });

  it('acepta el largo máximo y rechaza uno más', () => {
    expect(normalizeCashCode('A'.repeat(CASH_CODE_MAX_LENGTH)).ok).toBe(true);
    expect(normalizeCashCode('A'.repeat(CASH_CODE_MAX_LENGTH + 1))).toEqual({ ok: false, error: CASH_CODE_ERROR });
  });

  it('rechaza vacío, espacios internos y símbolos', () => {
    for (const raw of ['', '   ', 'C 1', 'C_1', 'C1/2', 'C1.', 'Cañón']) {
      expect(normalizeCashCode(raw), raw).toEqual({ ok: false, error: CASH_CODE_ERROR });
    }
  });
});

describe('validReturnWindow', () => {
  it('acepta enteros de 0 a 365', () => {
    expect([0, 1, 30, 365].every(validReturnWindow)).toBe(true);
  });

  it('rechaza vacío, negativos, decimales y más de 365', () => {
    for (const days of [null, -1, 1.5, 366, NaN]) expect(validReturnWindow(days), String(days)).toBe(false);
  });
});

describe('needsLocationAssignment', () => {
  it('Supervisor y Cajero sin sedes deben pedir que se las asignen', () => {
    expect(needsLocationAssignment({ role: 'Supervisor' }, [])).toBe(true);
    expect(needsLocationAssignment({ role: 'Usuario' }, [])).toBe(true);
    expect(needsLocationAssignment({ role: 'Usuario' }, [3])).toBe(false);
  });

  it('el Administrador opera en todas sin asignación, y sin sesión no hay aviso', () => {
    expect(needsLocationAssignment({ role: 'Administrador' }, [])).toBe(false);
    expect(needsLocationAssignment(null, [])).toBe(false);
  });
});

describe('toggleLocation', () => {
  it('agrega sin duplicar y deja la lista ordenada', () => {
    expect(toggleLocation([3, 1], 2, true)).toEqual([1, 2, 3]);
    expect(toggleLocation([1, 2], 2, true)).toEqual([1, 2]);
  });

  it('quita solo la sede indicada y puede dejar la lista vacía', () => {
    expect(toggleLocation([1, 2, 3], 2, false)).toEqual([1, 3]);
    expect(toggleLocation([1], 1, false)).toEqual([]);
  });
});

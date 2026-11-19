import { HttpErrorResponse } from '@angular/common/http';
import { differenceInfo, expectedNote, isNoCurrentShift, openShiftConflict } from './shift-rules';

const httpError = (status: number, detail?: unknown) => new HttpErrorResponse({ status, error: { detail } });

describe('openShiftConflict (los dos 409 de abrir turno)', () => {
  it('«la caja ya tiene un turno abierto» es la caja ocupada', () => {
    const error = httpError(409, 'La caja ya tiene un turno abierto: debe cerrarse antes de abrir otro');
    expect(openShiftConflict(error)).toEqual({
      kind: 'register_busy',
      message: 'La caja ya tiene un turno abierto: debe cerrarse antes de abrir otro',
    });
  });

  it('«ya tienes un turno abierto» es el usuario ocupado, y no se confunde con el anterior', () => {
    const error = httpError(409, 'Ya tienes un turno abierto: ciérralo antes de abrir otro');
    expect(openShiftConflict(error)?.kind).toBe('user_busy');
  });

  it('caja o sede inactivas son otro caso', () => {
    expect(openShiftConflict(httpError(409, 'La caja está inactiva: no se pueden abrir turnos en ella'))?.kind).toBe('inactive');
    expect(openShiftConflict(httpError(409, 'La sede de la caja está inactiva: no se pueden abrir turnos en ella'))?.kind).toBe('inactive');
  });

  it('un 409 desconocido conserva el texto de la API', () => {
    expect(openShiftConflict(httpError(409, 'Otro motivo'))).toEqual({ kind: 'other', message: 'Otro motivo' });
  });

  it('lo que no es 409 no es un conflicto de apertura', () => {
    expect(openShiftConflict(httpError(404, 'Caja no encontrada'))).toBeNull();
    expect(openShiftConflict(httpError(422, []))).toBeNull();
    expect(openShiftConflict(new Error('x'))).toBeNull();
  });
});

describe('isNoCurrentShift', () => {
  it('el 404 de /current significa «sin turno»', () => {
    expect(isNoCurrentShift(httpError(404, 'No tienes un turno abierto'))).toBe(true);
    expect(isNoCurrentShift(httpError(500))).toBe(false);
    expect(isNoCurrentShift(httpError(403))).toBe(false);
  });
});

describe('differenceInfo', () => {
  it('positivo es sobrante, con signo +', () => {
    expect(differenceInfo('500.00')).toEqual({ kind: 'sobrante', label: 'Sobrante', amount: '$ 500', signed: '+$ 500' });
  });

  it('negativo es faltante, con el monto sin signo y el signo aparte', () => {
    expect(differenceInfo('-12500.50')).toEqual({
      kind: 'faltante',
      label: 'Faltante',
      amount: '$ 12.500,50',
      signed: '-$ 12.500,50',
    });
  });

  it('cero es cuadre exacto (también -0.00)', () => {
    expect(differenceInfo('0.00')?.kind).toBe('exacto');
    expect(differenceInfo('-0.00')?.kind).toBe('exacto');
  });

  it('sin diferencia (turno abierto) no hay rótulo', () => {
    expect(differenceInfo(null)).toBeNull();
    expect(differenceInfo(undefined)).toBeNull();
  });
});

describe('expectedNote', () => {
  it('un esperado negativo se explica, no es un error', () => {
    expect(expectedNote('-5000.00')).toContain('negativo');
    expect(expectedNote('5000.00')).toBeNull();
    expect(expectedNote('0.00')).toBeNull();
    expect(expectedNote(null)).toBeNull();
  });
});

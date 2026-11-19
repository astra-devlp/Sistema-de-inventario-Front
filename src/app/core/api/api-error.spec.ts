import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { apiRowErrors, deleteConflictMessage, httpErrorMessage, isConflict, isPlanExpired, retryAfterSeconds } from './api-error';

function httpError(status: number, body?: unknown, headers?: Record<string, string>): HttpErrorResponse {
  return new HttpErrorResponse({ status, error: body, headers: new HttpHeaders(headers) });
}

describe('httpErrorMessage', () => {
  it('muestra tal cual el detail de texto', () => {
    expect(httpErrorMessage(httpError(401, { detail: 'Correo o contraseña incorrectos' }), 'No se pudo')).toBe(
      'Correo o contraseña incorrectos',
    );
    expect(httpErrorMessage(httpError(409, { detail: 'Ya tienes un turno abierto' }), 'No se pudo')).toBe(
      'Ya tienes un turno abierto',
    );
  });

  it('usa detail.message cuando el detail es un objeto (plan vencido, errores por renglón)', () => {
    const planVencido = httpError(403, { detail: { code: 'plan_vencido', message: 'El plan de la empresa venció' } });
    expect(httpErrorMessage(planVencido, 'No se pudo')).toBe('El plan de la empresa venció');
    const renglones = httpError(409, {
      detail: { message: 'La venta tiene renglones con error: no se guardó nada', errors: [] },
    });
    expect(httpErrorMessage(renglones, 'No se pudo')).toBe('La venta tiene renglones con error: no se guardó nada');
  });

  it('lista los campos de un 422 estándar de FastAPI sin repetirlos', () => {
    const error = httpError(422, {
      detail: [
        { loc: ['body', 'name'], msg: 'x' },
        { loc: ['body', 'email'], msg: 'x' },
        { loc: ['body', 'name'], msg: 'x' },
      ],
    });
    expect(httpErrorMessage(error, 'No se pudo guardar')).toBe('No se pudo guardar. Revisa: name, email');
  });

  it('distingue falta de conexión, 403 sin detalle, 429 y errores del servidor', () => {
    expect(httpErrorMessage(httpError(0), 'No se pudo')).toContain('No hay conexión');
    expect(httpErrorMessage(httpError(403, {}), 'No se pudo')).toContain('No tienes permiso');
    expect(httpErrorMessage(httpError(429, {}), 'No se pudo')).toContain('Demasiados intentos');
    expect(httpErrorMessage(httpError(500, {}), 'No se pudo')).toContain('(500)');
    expect(httpErrorMessage(httpError(401, {}), 'No se pudo')).toContain('Sesión vencida');
  });

  it('devuelve el texto de respaldo si no es un error HTTP', () => {
    expect(httpErrorMessage(new Error('x'), 'No se pudo')).toBe('No se pudo');
  });
});

describe('isPlanExpired', () => {
  it('solo es verdadero para el 403 con detail.code plan_vencido', () => {
    expect(isPlanExpired(httpError(403, { detail: { code: 'plan_vencido', message: 'x' } }))).toBe(true);
    expect(isPlanExpired(httpError(403, { detail: 'Esta operación requiere la autorización de un supervisor' }))).toBe(
      false,
    );
    expect(isPlanExpired(httpError(403, { detail: 'Autorización no válida' }))).toBe(false);
    expect(isPlanExpired(httpError(401, { detail: { code: 'plan_vencido' } }))).toBe(false);
    expect(isPlanExpired(new Error('x'))).toBe(false);
  });
});

describe('retryAfterSeconds', () => {
  it('lee los segundos de la cabecera Retry-After', () => {
    expect(retryAfterSeconds(httpError(429, {}, { 'Retry-After': '120' }))).toBe(120);
  });

  it('devuelve null si falta o no es un número de segundos', () => {
    expect(retryAfterSeconds(httpError(429, {}))).toBeNull();
    expect(retryAfterSeconds(httpError(429, {}, { 'Retry-After': 'abc' }))).toBeNull();
    expect(retryAfterSeconds(httpError(429, {}, { 'Retry-After': '-5' }))).toBeNull();
    expect(retryAfterSeconds(new Error('x'))).toBeNull();
  });
});

describe('apiRowErrors', () => {
  it('lee detail.errors[] de una venta con renglones en error', () => {
    const error = httpError(409, {
      detail: {
        message: 'La venta tiene renglones con error: no se guardó nada',
        errors: [
          {
            index: 0,
            product_id: 10,
            code: 'stock_insuficiente',
            reason: 'Stock insuficiente: hay 1 en la sede y se piden 2',
            requested: '2',
            available: '1',
          },
          { index: 2, product_id: 12, code: 'producto_inactivo', reason: 'Producto inactivo: no se puede vender' },
        ],
      },
    });
    expect(apiRowErrors(error)).toEqual([
      {
        index: 0,
        productId: 10,
        code: 'stock_insuficiente',
        reason: 'Stock insuficiente: hay 1 en la sede y se piden 2',
        requested: '2',
        available: '1',
        saleLineId: undefined,
      },
      {
        index: 2,
        productId: 12,
        code: 'producto_inactivo',
        reason: 'Producto inactivo: no se puede vender',
        requested: undefined,
        available: undefined,
        saleLineId: undefined,
      },
    ]);
  });

  it('devuelve la lista vacía si el detail no trae errores por renglón', () => {
    expect(apiRowErrors(httpError(422, { detail: 'texto' }))).toEqual([]);
    expect(apiRowErrors(httpError(422, { detail: [{ loc: ['body'], msg: 'x' }] }))).toEqual([]);
    expect(apiRowErrors(new Error('x'))).toEqual([]);
  });
});

describe('isConflict y deleteConflictMessage', () => {
  it('solo el 409 es un conflicto', () => {
    expect(isConflict(httpError(409, { detail: 'x' }))).toBe(true);
    for (const status of [400, 403, 404, 422, 500]) expect(isConflict(httpError(status))).toBe(false);
    expect(isConflict(new Error('x'))).toBe(false);
  });

  it('un 409 al borrar muestra el motivo de la API y propone desactivar', () => {
    const detail = 'La sede tiene movimientos de stock: desactívala en lugar de eliminarla';
    expect(deleteConflictMessage(httpError(409, { detail }), 'No se pudo eliminar')).toBe(
      `${detail}. Puedes desactivarlo en su lugar.`,
    );
  });

  it('otros errores no proponen desactivar', () => {
    expect(deleteConflictMessage(httpError(404, { detail: 'Caja no encontrada' }), 'x')).toBe('Caja no encontrada');
    expect(deleteConflictMessage(httpError(403), 'No se pudo eliminar')).toContain('No tienes permiso');
  });
});

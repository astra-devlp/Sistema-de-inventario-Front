import { HttpErrorResponse } from '@angular/common/http';
import { shortageLines } from '../stock/stock-errors';
import { isRetryableWithSameKey, saleErrorKind, saleRowErrors } from './sale-errors';

const httpError = (status: number, detail?: unknown) => new HttpErrorResponse({ status, error: detail === undefined ? null : { detail } });

const stockDetail = {
  message: 'La venta tiene renglones con error: no se guardó nada',
  errors: [
    { index: 0, product_id: 10, code: 'stock_insuficiente', reason: 'Stock insuficiente: hay 1 en la sede y se piden 2', requested: '2.000', available: '1.000' },
    { index: 2, product_id: 12, code: 'stock_insuficiente', reason: 'Stock insuficiente', requested: '5', available: '0' },
  ],
};

describe('saleErrorKind', () => {
  it('409 con renglones es de stock', () => {
    expect(saleErrorKind(httpError(409, stockDetail))).toBe('stock');
  });

  it('409 «No tienes un turno abierto» lleva a abrir turno', () => {
    expect(saleErrorKind(httpError(409, 'No tienes un turno abierto: ábrelo para vender'))).toBe('no_shift');
  });

  it('409 de clave repetida es otro caso', () => {
    expect(saleErrorKind(httpError(409, 'La clave de idempotencia ya se usó en otra venta'))).toBe('key_reused');
  });

  it('422 con renglones se marca en el carrito; 422 de texto son los pagos', () => {
    const rows = { message: 'x', errors: [{ index: 1, product_id: 11, code: 'producto_inactivo', reason: 'Producto inactivo: no se puede vender' }] };
    expect(saleErrorKind(httpError(422, rows))).toBe('rows');
    expect(saleErrorKind(httpError(422, 'Los pagos no cubren el total de la venta: faltan 190.00'))).toBe('payments');
  });

  it('un 422 estándar de FastAPI (lista), un 404 o un error que no es HTTP son «other»', () => {
    expect(saleErrorKind(httpError(422, [{ loc: ['body', 'items'], msg: 'x' }]))).toBe('other');
    expect(saleErrorKind(httpError(404, 'Cliente no encontrado'))).toBe('other');
    expect(saleErrorKind(new Error('x'))).toBe('other');
  });
});

describe('isRetryableWithSameKey', () => {
  it('sin respuesta (red) o 5xx se reintenta con la misma clave; los 4xx no', () => {
    expect(isRetryableWithSameKey(httpError(0))).toBe(true);
    expect(isRetryableWithSameKey(httpError(500))).toBe(true);
    expect(isRetryableWithSameKey(httpError(503))).toBe(true);
    for (const status of [400, 403, 404, 409, 422, 429]) expect(isRetryableWithSameKey(httpError(status))).toBe(false);
  });
});

describe('saleRowErrors (por renglón, índice desde 0)', () => {
  it('marca cada renglón con su error; el de stock dice pedido y disponible sin ceros de relleno', () => {
    const rows = saleRowErrors(httpError(409, stockDetail));
    expect([...rows.keys()]).toEqual([0, 2]);
    expect(rows.get(0)).toBe('Stock insuficiente: pides 2 y hay 1');
    expect(rows.get(2)).toBe('Stock insuficiente: pides 5 y hay 0');
  });

  it('los 422 de renglón conservan el motivo de la API', () => {
    const detail = {
      message: 'x',
      errors: [
        { index: 1, product_id: 11, code: 'producto_sin_precio', reason: 'El producto no tiene precio' },
        { index: 3, product_id: 13, code: 'cantidad_invalida', reason: 'La cantidad debe ser mayor que cero' },
      ],
    };
    const rows = saleRowErrors(httpError(422, detail));
    expect(rows.get(1)).toBe('El producto no tiene precio');
    expect(rows.get(3)).toBe('La cantidad debe ser mayor que cero');
  });

  it('un renglón con dos errores los junta', () => {
    const detail = { errors: [{ index: 0, reason: 'a' }, { index: 0, reason: 'b' }] };
    expect(saleRowErrors(httpError(422, detail)).get(0)).toBe('a. b');
  });

  it('sin lista de renglones queda vacío', () => {
    expect(saleRowErrors(httpError(422, 'Los pagos no cubren el total')).size).toBe(0);
  });
});

describe('faltantes del 409 de venta (reutiliza la lista de stock)', () => {
  it('lista todos los faltantes con el nombre del producto', () => {
    const names = (id: number | undefined) => ({ 10: 'Gaseosa 1.5 L', 12: 'Arroz 1 kg' })[id as 10 | 12] ?? `Producto ${id}`;
    expect(shortageLines(httpError(409, stockDetail), names)).toEqual([
      'Gaseosa 1.5 L: se piden 2 y hay 1',
      'Arroz 1 kg: se piden 5 y hay 0',
    ]);
  });
});

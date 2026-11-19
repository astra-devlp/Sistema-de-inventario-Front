import { HttpErrorResponse } from '@angular/common/http';
import { initialRowErrors, shortageLines, stockErrorMessage } from './stock-errors';

const httpError = (status: number, detail: unknown) => new HttpErrorResponse({ status, error: { detail } });

describe('initialRowErrors', () => {
  it('mapea cada fila con error por su índice, que empieza en 0', () => {
    const error = httpError(422, {
      message: 'El inventario inicial tiene filas con error: no se guardó nada',
      errors: [
        { index: 0, product_id: 10, reason: 'La cantidad debe ser mayor que cero' },
        { index: 2, product_id: 999, reason: 'Producto no encontrado' },
      ],
    });
    const rows = initialRowErrors(error);
    expect([...rows.keys()]).toEqual([0, 2]);
    expect(rows.get(0)).toBe('La cantidad debe ser mayor que cero');
    expect(rows.get(2)).toBe('Producto no encontrado');
  });

  it('deja la primera razón si una fila viene repetida', () => {
    const error = httpError(422, { errors: [{ index: 1, reason: 'a' }, { index: 1, reason: 'b' }] });
    expect(initialRowErrors(error).get(1)).toBe('a');
  });

  it('un 422 estándar de FastAPI (lista) o cualquier otro error no tiene filas', () => {
    expect(initialRowErrors(httpError(422, [{ loc: ['body', 'items'], msg: 'x' }])).size).toBe(0);
    expect(initialRowErrors(new Error('x')).size).toBe(0);
  });
});

describe('shortageLines', () => {
  const detail = {
    message: 'Stock insuficiente en 2 renglones: no se guardó nada',
    errors: [
      { index: 0, product_id: 10, code: 'stock_insuficiente', reason: 'Stock insuficiente', requested: '2.000', available: '1.000' },
      { index: 1, product_id: 11, code: 'producto_inactivo', reason: 'Inactivo' },
      { index: 2, product_id: 12, code: 'stock_insuficiente', reason: 'Stock insuficiente: hay 0', requested: '5', available: '0' },
    ],
  };
  const names = (id: number | undefined) => ({ 10: 'Gaseosa', 12: 'Arroz' })[id as 10 | 12] ?? `Producto ${id}`;

  it('lista todos los faltantes con lo pedido y lo disponible, sin ceros de relleno', () => {
    expect(shortageLines(httpError(409, detail), names)).toEqual([
      'Gaseosa: se piden 2 y hay 1',
      'Arroz: se piden 5 y hay 0',
    ]);
  });

  it('sin cantidades usa el motivo de la API', () => {
    const error = httpError(409, { errors: [{ index: 0, product_id: 10, code: 'stock_insuficiente', reason: 'No alcanza' }] });
    expect(shortageLines(error, names)).toEqual(['Gaseosa: No alcanza']);
  });

  it('solo un 409 es un faltante', () => {
    expect(shortageLines(httpError(422, detail), names)).toEqual([]);
  });
});

describe('stockErrorMessage', () => {
  it('muestra el texto de la API cuando no hay lista de faltantes', () => {
    const error = httpError(409, 'Stock insuficiente: hay 3 en la sede y se intentan descontar 10');
    expect(stockErrorMessage(error, 'No se pudo')).toEqual(['Stock insuficiente: hay 3 en la sede y se intentan descontar 10']);
    expect(stockErrorMessage(httpError(409, 'El conteo coincide con el stock actual (5): no hay nada que ajustar'), 'x')).toEqual([
      'El conteo coincide con el stock actual (5): no hay nada que ajustar',
    ]);
  });

  it('lista los faltantes cuando vienen por renglón', () => {
    const error = httpError(409, {
      errors: [{ index: 0, product_id: 7, code: 'stock_insuficiente', reason: 'x', requested: '3', available: '1' }],
    });
    expect(stockErrorMessage(error, 'x')).toEqual(['Producto 7: se piden 3 y hay 1']);
  });
});

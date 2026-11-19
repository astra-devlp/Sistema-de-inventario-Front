import { CartLine, addProduct, cartPreviewTotal, decideLookup, removeLine, setLineQuantity, validateLineQuantity } from './cart';
import { PosProduct } from './sale.model';

const product = (id: number, price = '3570.00', name = `Producto ${id}`): PosProduct => ({
  id,
  name,
  sku: `P-${id}`,
  barcode: null,
  brand: null,
  unit_id: 1,
  tax_id: null,
  price_with_tax: price,
});

const line = (p: PosProduct, quantity: string): CartLine => ({ product: p, quantity, unitType: 'Cantidad' });

describe('decideLookup (qué hacer con la búsqueda)', () => {
  it('código o SKU con un solo resultado se agrega directo', () => {
    expect(decideLookup({ match: 'code', items: [product(1)], has_more: false })).toEqual({ action: 'add', product: product(1) });
    expect(decideLookup({ match: 'sku', items: [product(2)], has_more: false })).toEqual({ action: 'add', product: product(2) });
  });

  it('código o SKU con varios resultados se elige de una lista', () => {
    const result = decideLookup({ match: 'code', items: [product(1), product(2)], has_more: false });
    expect(result).toEqual({ action: 'choose', products: [product(1), product(2)], hasMore: false });
  });

  it('por nombre siempre se elige, aunque haya uno solo, y avisa si hay más resultados', () => {
    expect(decideLookup({ match: 'name', items: [product(1)], has_more: false }).action).toBe('choose');
    expect(decideLookup({ match: 'name', items: [product(1), product(2)], has_more: true })).toMatchObject({ hasMore: true });
  });

  it('sin resultados avisa', () => {
    expect(decideLookup({ match: 'none', items: [], has_more: false })).toEqual({ action: 'none' });
    expect(decideLookup({ match: 'name', items: [], has_more: false })).toEqual({ action: 'none' });
  });
});

describe('addProduct', () => {
  it('agrega un renglón nuevo con cantidad 1', () => {
    const result = addProduct([], product(1), 'Cantidad');
    expect(result.ok && result.lines).toEqual([line(product(1), '1')]);
  });

  it('un producto ya agregado suma 1 en su renglón, sin duplicarlo', () => {
    const result = addProduct([line(product(1), '2')], product(1), 'Cantidad');
    expect(result.ok && result.lines).toEqual([line(product(1), '3')]);
  });

  it('suma con decimales sin pasar por number', () => {
    const result = addProduct([{ product: product(1), quantity: '0.1', unitType: 'Peso' }], product(1), 'Peso');
    expect(result.ok && result.lines[0].quantity).toBe('1.1');
  });

  it('un producto con precio cero no se puede vender', () => {
    const result = addProduct([], product(1, '0.00', 'Agua'), 'Cantidad');
    expect(result).toEqual({ ok: false, error: '«Agua» no tiene precio: ponle un precio antes de venderlo' });
  });

  it('respeta el máximo de 200 renglones, pero deja sumar a uno que ya está', () => {
    const full = Array.from({ length: 200 }, (_, i) => line(product(i + 1), '1'));
    expect(addProduct(full, product(999), 'Cantidad')).toEqual({ ok: false, error: 'El carrito admite como máximo 200 renglones' });
    expect(addProduct(full, product(1), 'Cantidad').ok).toBe(true);
  });

  it('no deja pasar de 100000 por renglón', () => {
    const result = addProduct([line(product(1), '100000')], product(1), 'Cantidad');
    expect(result.ok).toBe(false);
  });
});

describe('cantidad del renglón', () => {
  it('se valida por unidad: enteras en «Cantidad», hasta 3 decimales en las demás', () => {
    expect(validateLineQuantity('2.5', 'Cantidad')).toEqual({
      ok: false,
      error: 'El producto se maneja por unidades enteras: la cantidad no puede tener decimales',
    });
    expect(validateLineQuantity('2,5', 'Peso')).toEqual({ ok: true, value: '2.5' });
    expect(validateLineQuantity('1.0005', 'Peso').ok).toBe(false);
    expect(validateLineQuantity('0', 'Cantidad').ok).toBe(false);
  });

  it('el máximo es 100000', () => {
    expect(validateLineQuantity('100000', 'Cantidad')).toEqual({ ok: true, value: '100000' });
    expect(validateLineQuantity('100000.001', 'Peso')).toEqual({ ok: false, error: 'La cantidad por renglón no puede superar 100000' });
    expect(validateLineQuantity('100001', 'Cantidad').ok).toBe(false);
  });

  it('setLineQuantity solo cambia el renglón indicado y no toca el carrito si es inválida', () => {
    const lines = [line(product(1), '1'), line(product(2), '1')];
    const ok = setLineQuantity(lines, 2, '5');
    expect(ok.ok && ok.lines.map((l) => l.quantity)).toEqual(['1', '5']);
    expect(setLineQuantity(lines, 2, 'abc').ok).toBe(false);
  });

  it('removeLine quita un renglón', () => {
    expect(removeLine([line(product(1), '1'), line(product(2), '1')], 1).map((l) => l.product.id)).toEqual([2]);
  });
});

describe('cartPreviewTotal', () => {
  it('suma los renglones redondeados: 2 gaseosas + 1 arroz = 11340', () => {
    expect(cartPreviewTotal([line(product(1, '3570.00'), '2'), line(product(2, '4200.00'), '1')])).toBe('11340.00');
  });
});

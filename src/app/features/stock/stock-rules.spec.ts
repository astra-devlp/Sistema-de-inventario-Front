import { minimumFor, validateTransfer } from './stock-rules';

describe('stock-rules', () => {
  it('el mínimo propio de la sede manda, también si es cero', () => {
    expect(minimumFor('12.000', 3)).toBe('12.000');
    expect(minimumFor('0.000', 3)).toBe('0.000');
  });

  it('sin mínimo propio vale el del producto', () => {
    expect(minimumFor(undefined, 3)).toBe('3');
  });

  it('un traslado necesita dos sedes distintas', () => {
    expect(validateTransfer({ fromLocationId: 1, toLocationId: null, quantity: '2', unitType: 'Cantidad' }).ok).toBe(false);
    const same = validateTransfer({ fromLocationId: 1, toLocationId: 1, quantity: '2', unitType: 'Cantidad' });
    expect(same).toEqual({ ok: false, error: 'La sede de origen y la de destino deben ser distintas' });
  });

  it('la cantidad del traslado sigue las reglas de la unidad', () => {
    expect(validateTransfer({ fromLocationId: 1, toLocationId: 2, quantity: '1.5', unitType: 'Cantidad' }).ok).toBe(false);
    expect(validateTransfer({ fromLocationId: 1, toLocationId: 2, quantity: '1.5', unitType: 'Peso' })).toEqual({ ok: true, value: '1.5' });
    expect(validateTransfer({ fromLocationId: 1, toLocationId: 2, quantity: '0', unitType: 'Peso' }).ok).toBe(false);
  });
});

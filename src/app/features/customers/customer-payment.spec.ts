import { IdempotencyKeys } from '@features/sales/idempotency';
import { checkPayment, paymentFingerprint } from './customer-payment';

describe('checkPayment', () => {
  it('en efectivo exige que lo recibido cubra el abono y lo manda', () => {
    expect(checkPayment('efectivo', '500', '1000', '1190.00')).toEqual({
      ok: true,
      body: { method: 'efectivo', amount: '500.00', received: '1000.00' },
    });
    expect(checkPayment('efectivo', '500', '400', '1190.00')).toEqual({ ok: false, error: 'En efectivo, lo recibido debe cubrir el abono' });
  });

  it('en efectivo sin recibido se asume el monto exacto', () => {
    expect(checkPayment('efectivo', '500', '', '1190.00')).toEqual({
      ok: true,
      body: { method: 'efectivo', amount: '500.00', received: '500.00' },
    });
  });

  it('tarjeta y transferencia no llevan recibido', () => {
    expect(checkPayment('tarjeta', '190', '999', '1190.00')).toEqual({ ok: true, body: { method: 'tarjeta', amount: '190.00' } });
  });

  it('no supera el saldo ni acepta montos inválidos', () => {
    expect(checkPayment('transferencia', '1190.01', '', '1190.00').ok).toBe(false);
    expect(checkPayment('transferencia', '0', '', '1190.00').ok).toBe(false);
    expect(checkPayment('transferencia', '10.555', '', '1190.00').ok).toBe(false);
  });

  it('un reintento del mismo abono reutiliza la clave; otro contenido usa una nueva', () => {
    let n = 0;
    const keys = new IdempotencyKeys<{ id: number; body: { method: 'tarjeta'; amount: string } }>(
      () => `clave-${++n}`,
      ({ id, body }) => paymentFingerprint(id, body),
    );
    const first = keys.keyFor({ id: 1, body: { method: 'tarjeta', amount: '100.00' } });
    expect(keys.keyFor({ id: 1, body: { method: 'tarjeta', amount: '100.00' } })).toBe(first);
    expect(keys.keyFor({ id: 1, body: { method: 'tarjeta', amount: '150.00' } })).not.toBe(first);
  });
});

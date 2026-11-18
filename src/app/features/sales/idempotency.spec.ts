import { IdempotencyKeys, newIdempotencyKey, requestFingerprint } from './idempotency';
import { SaleCreatePayload } from './sale.model';

type Body = Omit<SaleCreatePayload, 'idempotency_key'>;

const base: Body = {
  items: [
    { product_id: 1, quantity: '2' },
    { product_id: 2, quantity: '0.5' },
  ],
  payments: [
    { method: 'tarjeta', amount: '100', reference: 'AP-1' },
    { method: 'efectivo', amount: '50' },
  ],
  customer_id: null,
};

function counter() {
  let n = 0;
  return () => `clave-${++n}`;
}

describe('requestFingerprint (misma normalización que el back)', () => {
  it('ignora ceros de más y el orden de los pagos', () => {
    const same: Body = {
      items: [
        { product_id: 1, quantity: '2.000' },
        { product_id: 2, quantity: '0.50' },
      ],
      payments: [
        { method: 'efectivo', amount: '50.00' },
        { method: 'tarjeta', amount: '100.0', reference: 'AP-1' },
      ],
      customer_id: null,
    };
    expect(requestFingerprint(same)).toBe(requestFingerprint(base));
  });

  it.each<[string, Body]>([
    ['otra cantidad', { ...base, items: [{ product_id: 1, quantity: '3' }, base.items[1]] }],
    ['otro orden de renglones', { ...base, items: [base.items[1], base.items[0]] }],
    ['un renglón menos', { ...base, items: [base.items[0]] }],
    ['otro monto', { ...base, payments: [base.payments[0], { method: 'efectivo', amount: '60' }] }],
    ['otro medio', { ...base, payments: [{ method: 'transferencia', amount: '100', reference: 'AP-1' }, base.payments[1]] }],
    ['otra referencia', { ...base, payments: [{ method: 'tarjeta', amount: '100', reference: 'AP-2' }, base.payments[1]] }],
    ['otro cliente', { ...base, customer_id: 7 }],
  ])('cambia con %s', (_name, other) => {
    expect(requestFingerprint(other)).not.toBe(requestFingerprint(base));
  });
});

describe('IdempotencyKeys', () => {
  it('reutiliza la clave con un cuerpo idéntico (reintento tras fallo de red o 5xx)', () => {
    const keys = new IdempotencyKeys(counter());
    const first = keys.keyFor(base);
    expect(keys.keyFor(base)).toBe(first);
    expect(keys.keyFor(structuredClone(base))).toBe(first);
  });

  it('reutiliza la clave aunque el mismo contenido se escriba distinto', () => {
    const keys = new IdempotencyKeys(counter());
    const first = keys.keyFor(base);
    const rewritten: Body = {
      ...base,
      items: [
        { product_id: 1, quantity: '2.000' },
        { product_id: 2, quantity: '0.500' },
      ],
    };
    expect(keys.keyFor(rewritten)).toBe(first);
  });

  it('genera una clave nueva si cambia el carrito o los pagos', () => {
    const keys = new IdempotencyKeys(counter());
    const first = keys.keyFor(base);
    const changedCart = keys.keyFor({ ...base, items: [{ product_id: 1, quantity: '3' }, base.items[1]] });
    expect(changedCart).not.toBe(first);
    const changedPayment = keys.keyFor({ ...base, payments: [{ method: 'efectivo', amount: '999' }] });
    expect(changedPayment).not.toBe(changedCart);
  });

  it('si el cuerpo vuelve a ser el de antes, la clave anterior ya no sirve: se pidió una nueva', () => {
    const keys = new IdempotencyKeys(counter());
    const first = keys.keyFor(base);
    keys.keyFor({ ...base, customer_id: 9 });
    expect(keys.keyFor(base)).not.toBe(first);
  });

  it('se renueva tras una venta confirmada, aunque el siguiente cuerpo sea idéntico', () => {
    const keys = new IdempotencyKeys(counter());
    const first = keys.keyFor(base);
    keys.renew();
    expect(keys.keyFor(base)).not.toBe(first);
  });
});

describe('newIdempotencyKey', () => {
  it('es un UUID válido para el back: 8 a 64 caracteres de letras, números, guion y guion bajo', () => {
    const key = newIdempotencyKey();
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
    expect(newIdempotencyKey()).not.toBe(key);
  });
});

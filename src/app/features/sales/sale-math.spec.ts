import {
  cartTotal,
  hasSellablePrice,
  lineAmounts,
  lineTotal,
  PaymentInput,
  remainingForCash,
  settlePayments,
} from './sale-math';

// Los mismos casos de `test_sale_rules.py` del back: (precio, cantidad, tarifa, exento, base, IVA, total).
const LINE_CASES: [string, string, string, boolean, string, string, string][] = [
  // 19 %
  ['1190.00', '1', '19', false, '1000.00', '190.00', '1190.00'],
  ['1190.00', '3', '19', false, '3000.00', '570.00', '3570.00'],
  ['999.99', '1', '19', false, '840.33', '159.66', '999.99'],
  ['3333.33', '0.333', '19', false, '932.77', '177.23', '1110.00'], // 1109.99889 -> 1110.00
  ['2500.00', '1.5', '19', false, '3151.26', '598.74', '3750.00'],
  ['0.01', '1', '19', false, '0.01', '0.00', '0.01'],
  ['100.00', '0.005', '19', false, '0.42', '0.08', '0.50'],
  // 5 %
  ['1050.00', '1', '5', false, '1000.00', '50.00', '1050.00'],
  ['999.99', '2.755', '5', false, '2623.78', '131.19', '2754.97'], // 2754.972... -> 2754.97
  ['3333.33', '3', '5', false, '9523.80', '476.19', '9999.99'],
  ['1.99', '0.333', '5', false, '0.63', '0.03', '0.66'],
  // exento, tarifa cero y sin IVA: la base es el total
  ['999.99', '2.755', '0', true, '2754.97', '0.00', '2754.97'],
  ['999.99', '2.755', '19', true, '2754.97', '0.00', '2754.97'], // exento manda sobre la tarifa
  ['1500.50', '1', '0', false, '1500.50', '0.00', '1500.50'],
];

describe('lineAmounts (casos del back)', () => {
  it.each(LINE_CASES)('%s × %s a %s%% (exento: %s)', (price, quantity, rate, exempt, base, tax, total) => {
    expect(lineAmounts(price, quantity, rate, exempt)).toEqual({ base, tax, total });
  });

  it('el total del renglón coincide con lineTotal', () => {
    for (const [price, quantity, , , , , total] of LINE_CASES) expect(lineTotal(price, quantity)).toBe(total);
  });

  it('redondea la mitad hacia arriba al centavo', () => {
    expect(lineTotal('0.05', '0.5')).toBe('0.03'); // 0.025 sube
    expect(lineTotal('0.03', '0.5')).toBe('0.02'); // 0.015 sube
    expect(lineTotal('0.01', '0.333')).toBe('0.00'); // 0.00333 baja a cero
  });

  it('base + IVA es siempre exactamente el total del renglón', () => {
    const prices = ['0.01', '0.99', '1.00', '9.99', '999.99', '1190.00', '3333.33', '12345.67'];
    const quantities = ['0.001', '0.333', '0.5', '1', '1.5', '2.755', '7', '13.125'];
    for (const price of prices) {
      for (const quantity of quantities) {
        for (const rate of ['19', '5', '8.5', '0']) {
          const a = lineAmounts(price, quantity, rate, false);
          const sum = (BigInt(a.base.replace('.', '')) + BigInt(a.tax.replace('.', ''))).toString();
          expect(sum, `${price} × ${quantity} a ${rate}%`).toBe(BigInt(a.total.replace('.', '')).toString());
        }
      }
    }
  });
});

describe('cartTotal (vista previa)', () => {
  it('suma los renglones ya redondeados, no el producto de la suma', () => {
    // Cada renglón: 0.05 × 0.5 = 0.025 → 0.03. Tres renglones suman 0.09; sin redondear por renglón serían 0.075 → 0.08.
    const lines = [1, 2, 3].map(() => ({ priceWithTax: '0.05', quantity: '0.5' }));
    expect(cartTotal(lines)).toBe('0.09');
  });

  it('el ejemplo de la prueba manual: 2 gaseosas a 3570 + 1 arroz a 4200 = 11340', () => {
    expect(
      cartTotal([
        { priceWithTax: '3570.00', quantity: '2' },
        { priceWithTax: '4200.00', quantity: '1' },
      ]),
    ).toBe('11340.00');
  });

  it('un carrito vacío suma cero y los montos grandes no pierden precisión', () => {
    expect(cartTotal([])).toBe('0.00');
    expect(cartTotal([{ priceWithTax: '9999999999.99', quantity: '1' }])).toBe('9999999999.99');
    expect(cartTotal([{ priceWithTax: '9007199254740.99', quantity: '1000' }])).toBe('9007199254740990.00');
  });

  it('cantidades con decimales', () => {
    expect(cartTotal([{ priceWithTax: '2500.00', quantity: '0.750' }])).toBe('1875.00');
  });
});

describe('hasSellablePrice', () => {
  it('cero, vacío o ilegible no se vende', () => {
    expect(hasSellablePrice('3570.00')).toBe(true);
    expect(hasSellablePrice('0.01')).toBe(true);
    expect(hasSellablePrice('0.00')).toBe(false);
    expect(hasSellablePrice('-5.00')).toBe(false);
    expect(hasSellablePrice('')).toBe(false);
    expect(hasSellablePrice(null)).toBe(false);
  });
});

// Los mismos casos de pagos del back.
const pay = (...pairs: [PaymentInput['method'], string][]): PaymentInput[] => pairs.map(([method, amount]) => ({ method, amount }));

describe('settlePayments (casos del back)', () => {
  it('efectivo exacto y con vuelto', () => {
    expect(settlePayments('1190.00', pay(['efectivo', '1190']))).toEqual({
      ok: true,
      applied: [{ method: 'efectivo', amount: '1190.00', received: '1190.00' }],
      change: '0.00',
    });
    expect(settlePayments('1190.00', pay(['efectivo', '2000']))).toEqual({
      ok: true,
      applied: [{ method: 'efectivo', amount: '1190.00', received: '2000.00' }],
      change: '810.00',
    });
  });

  it('tarjeta más efectivo: el efectivo cubre lo que falta y el resto es vuelto', () => {
    const result = settlePayments('1190.00', pay(['tarjeta', '1000'], ['efectivo', '200']));
    expect(result).toEqual({
      ok: true,
      applied: [
        { method: 'tarjeta', amount: '1000.00', received: null },
        { method: 'efectivo', amount: '190.00', received: '200.00' },
      ],
      change: '10.00',
    });
  });

  it('tarjeta más transferencia que suman exactamente el total, sin efectivo', () => {
    const result = settlePayments('1190.00', pay(['tarjeta', '500'], ['transferencia', '690']));
    expect(result.ok && result.change).toBe('0.00');
  });

  it('tres medios con vuelto', () => {
    const result = settlePayments('1190.00', pay(['tarjeta', '500'], ['transferencia', '600'], ['efectivo', '100']));
    expect(result.ok && result.change).toBe('10.00');
    expect(result.ok && result.applied.at(-1)).toEqual({ method: 'efectivo', amount: '90.00', received: '100.00' });
  });

  it('la venta del recibo de la prueba manual: tarjeta 5000 + efectivo 10000 sobre 11340', () => {
    const result = settlePayments('11340.00', pay(['tarjeta', '5000'], ['efectivo', '10000']));
    expect(result.ok && result.change).toBe('3660.00');
    expect(result.ok && result.applied.at(-1)).toEqual({ method: 'efectivo', amount: '6340.00', received: '10000.00' });
  });

  it('lo aplicado suma exactamente el total', () => {
    const result = settlePayments('0.66', pay(['tarjeta', '0.65'], ['efectivo', '50000']));
    expect(result.ok && result.change).toBe('49999.99');
    expect(result.ok && result.applied.map((p) => p.amount)).toEqual(['0.65', '0.01']);
  });

  it.each([
    ['1190.00', [['tarjeta', '1190.01']], 'superan el total'],
    ['1190.00', [['tarjeta', '600'], ['transferencia', '600']], 'superan el total'],
    ['1190.00', [['tarjeta', '1200'], ['efectivo', '100']], 'superan el total'],
    ['1190.00', [['tarjeta', '1000']], 'faltan 190.00'],
    ['1190.00', [['efectivo', '1189.99']], 'faltan 0.01'],
    ['1190.00', [['tarjeta', '1000'], ['efectivo', '100']], 'faltan 90.00'],
    ['1190.00', [['tarjeta', '1190'], ['efectivo', '100']], 'no se recibe efectivo'],
    ['1190.00', [['efectivo', '600'], ['efectivo', '600']], 'una sola vez'],
    ['1190.00', [['efectivo', '0']], 'mayor que cero'],
    ['1190.00', [['efectivo', '-5']], 'mayor que cero'],
    ['1190.00', [['tarjeta', '1190.001']], '2 decimales'],
  ] as [string, [PaymentInput['method'], string][], string][])('rechaza %s con %j', (total, pairs, message) => {
    const result = settlePayments(total, pay(...pairs));
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(message);
  });

  it('sin pagos no se cobra', () => {
    expect(settlePayments('100.00', []).ok).toBe(false);
  });
});

describe('remainingForCash («Exacto»)', () => {
  it('es lo que falta tras tarjeta y transferencia, nunca negativo', () => {
    expect(remainingForCash('11340.00', [])).toBe('11340.00');
    expect(remainingForCash('11340.00', ['5000'])).toBe('6340.00');
    expect(remainingForCash('11340.00', ['5000', '6340'])).toBe('0.00');
    expect(remainingForCash('100.00', ['500'])).toBe('0.00');
  });
});

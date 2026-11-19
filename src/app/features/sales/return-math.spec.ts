import {
  ReturnableLine,
  availableToReturn,
  checkRefunds,
  refundCaps,
  returnTotal,
  returnedByLine,
  suggestRefunds,
  trancheAmounts,
  validateReturnQuantity,
} from './return-math';
import { SaleReturn } from './return.model';
import { lineAmounts, lineTotal } from './sale-math';

// Los renglones de `test_sale_returns.py` del back: colas (1190, IVA 19 %) y queso (999.99, IVA 5 %).
function lineOf(id: number, price: string, quantity: string, rate: string, returned = '0'): ReturnableLine {
  const a = lineAmounts(price, quantity, rate, false);
  return {
    id,
    quantity,
    unit_price_with_tax: price,
    tax_rate: rate,
    is_exempt: false,
    line_total: a.total,
    line_tax: a.tax,
    returned_quantity: returned,
  };
}

const cola = lineOf(31, '1190.00', '2', '19');
const queso = lineOf(32, '999.99', '1.5', '5');

function saleReturn(lines: { sale_line_id: number; quantity: string; amount: string; tax_amount: string }[]): SaleReturn {
  return { lines: lines.map((l, i) => ({ id: i + 1, ...l })) } as unknown as SaleReturn;
}

describe('trancheAmounts (casos del back)', () => {
  it('devolver 2 colas y 0.250 de queso vale 2380.00 + 250.00 = 2630.00', () => {
    // 999.99 × 0.250 = 249.9975 → 250.00; las colas completan su renglón
    expect(trancheAmounts(cola, '2').amount).toBe('2380.00');
    expect(trancheAmounts(queso, '0.250').amount).toBe('250.00');
    expect(returnTotal([{ line: cola, quantity: '2' }, { line: queso, quantity: '0.250' }], new Map())).toBe('2630.00');
  });

  it('los tramos de un renglón suman exactamente lo cobrado: el último se lleva los centavos', () => {
    const sold = lineOf(40, '999.99', '2.755', '5');
    expect(sold.line_total).toBe('2754.97');
    let returned = { quantity: '0', amount: '0.00', tax: '0.00' };
    const amounts: string[] = [];
    let taxes = 0n;
    let total = 0n;
    for (const quantity of ['0.001', '1.000', '0.754', '1.000']) {
      const tranche = trancheAmounts(sold, quantity, returned);
      amounts.push(tranche.amount);
      total += BigInt(tranche.amount.replace('.', ''));
      taxes += BigInt(tranche.tax.replace('.', ''));
      returned = {
        quantity: String(Number(returned.quantity) + Number(quantity)), // solo para el caso de prueba
        amount: (Number(total) / 100).toFixed(2),
        tax: (Number(taxes) / 100).toFixed(2),
      };
    }
    // 0.99999 → 1.00; 999.99; 753.99246 → 753.99; el último: 2754.97 − 1754.98 = 999.99
    expect(amounts).toEqual(['1.00', '999.99', '753.99', '999.99']);
    expect(total).toBe(275497n);
    expect(taxes).toBe(BigInt(sold.line_tax.replace('.', '')));
  });

  it('por pasos: 1 queso + el resto del 1.5 (el último tramo lleva lo que falta)', () => {
    const first = trancheAmounts(queso, '1.000');
    expect(first.amount).toBe('999.99');
    const rest = trancheAmounts(queso, '0.500', { quantity: '1', amount: first.amount, tax: first.tax });
    expect(rest.amount).toBe('500.00'); // 1499.99 − 999.99, no 999.99 × 0.5 = 499.995 → 500.00 por casualidad
    expect(rest.amount).toBe(lineTotal('1499.99', '1').replace('1499.99', '500.00'));
  });

  it('el IVA del último tramo es lo que falta del IVA del renglón', () => {
    const first = trancheAmounts(queso, '1.000');
    const rest = trancheAmounts(queso, '0.500', { quantity: '1', amount: first.amount, tax: first.tax });
    expect(BigInt(first.tax.replace('.', '')) + BigInt(rest.tax.replace('.', ''))).toBe(BigInt(queso.line_tax.replace('.', '')));
  });

  it('un tramo nunca pasa de lo que falta del renglón', () => {
    const almost = { quantity: '1.4', amount: '1499.50', tax: '71.40' };
    // 999.99 × 0.05 = 50.00 > lo que falta (0.49) pero 1.4 + 0.05 no completa: se topa en lo que queda
    expect(trancheAmounts(queso, '0.050', almost).amount).toBe('0.49');
  });
});

describe('returnedByLine', () => {
  it('suma cantidad, valor e IVA ya devueltos por renglón, de todas las devoluciones', () => {
    const map = returnedByLine([
      saleReturn([{ sale_line_id: 32, quantity: '1.000', amount: '999.99', tax_amount: '47.62' }]),
      saleReturn([
        { sale_line_id: 32, quantity: '0.250', amount: '250.00', tax_amount: '11.90' },
        { sale_line_id: 31, quantity: '1', amount: '1190.00', tax_amount: '190.00' },
      ]),
    ]);
    expect(map.get(32)).toEqual({ quantity: '1.25', amount: '1249.99', tax: '59.52' });
    expect(map.get(31)).toEqual({ quantity: '1', amount: '1190.00', tax: '190.00' });
    expect(map.get(99)).toBeUndefined();
  });
});

describe('topes por renglón', () => {
  it('se puede devolver lo vendido menos lo ya devuelto', () => {
    expect(availableToReturn({ quantity: '2', returned_quantity: '1' })).toBe('1');
    expect(availableToReturn({ quantity: '1.5', returned_quantity: '0.250' })).toBe('1.25');
    expect(availableToReturn({ quantity: '2', returned_quantity: '2' })).toBe('0');
  });

  it('valida la cantidad por unidad y contra lo que queda', () => {
    const line = { quantity: '2', returned_quantity: '1' };
    expect(validateReturnQuantity('1', 'Cantidad', line)).toEqual({ ok: true, value: '1' });
    expect(validateReturnQuantity('2', 'Cantidad', line).ok).toBe(false);
    expect(validateReturnQuantity('0', 'Cantidad', line).ok).toBe(false);
    expect(validateReturnQuantity('0.5', 'Cantidad', line).ok).toBe(false); // unidades enteras
    expect(validateReturnQuantity('0,5', 'Peso', { quantity: '2', returned_quantity: '1' })).toEqual({ ok: true, value: '0.5' });
    expect(validateReturnQuantity('x', 'Peso', line).ok).toBe(false);
  });

  it('el mensaje de exceso dice lo vendido, lo devuelto y lo que queda', () => {
    const result = validateReturnQuantity('2', 'Cantidad', { quantity: '2', returned_quantity: '1' });
    expect(!result.ok && result.error).toBe('Se pueden devolver como máximo 1 (se vendieron 2 y ya se devolvieron 1)');
  });
});

// 5 colas = 5950.00: tarjeta 1000, transferencia 950 y efectivo 4000 aplicados (de 4500 recibidos).
const mixed = [
  { method: 'tarjeta' as const, amount: '1000.00', refunded_amount: '0.00' },
  { method: 'transferencia' as const, amount: '950.00', refunded_amount: '0.00' },
  { method: 'efectivo' as const, amount: '4000.00', refunded_amount: '0.00' },
];

describe('reembolsos: topes por medio', () => {
  it('el tope es lo pagado por el medio menos lo ya devuelto (en efectivo, lo aplicado)', () => {
    expect(Object.fromEntries(refundCaps(mixed))).toEqual({ tarjeta: '1000.00', transferencia: '950.00', efectivo: '4000.00' });
    const partly = [{ ...mixed[0], refunded_amount: '400.00' }, mixed[2]];
    expect(refundCaps(partly).get('tarjeta')).toBe('600.00');
    expect(refundCaps([{ ...mixed[0], refunded_amount: '1000.00' }]).get('tarjeta')).toBe('0.00');
  });

  it('la propuesta reparte en orden sin pasar el tope de cada medio', () => {
    expect(Object.fromEntries(suggestRefunds('1500.00', mixed))).toEqual({ tarjeta: '1000.00', transferencia: '500.00' });
    expect(Object.fromEntries(suggestRefunds('800.00', mixed))).toEqual({ tarjeta: '800.00' });
    expect(Object.fromEntries(suggestRefunds('5950.00', mixed))).toEqual({ tarjeta: '1000.00', transferencia: '950.00', efectivo: '4000.00' });
  });

  it('si los topes no alcanzan, queda lo que no se pudo asignar', () => {
    const sum = [...suggestRefunds('7000.00', mixed).values()].reduce((s, v) => s + Number(v), 0);
    expect(sum).toBe(5950);
  });

  it('acepta reembolsos que suman exactamente el valor y respetan cada tope', () => {
    expect(checkRefunds('1500.00', mixed, { tarjeta: '1000.00', transferencia: '500' })).toEqual({
      ok: true,
      refunds: [
        { method: 'tarjeta', amount: '1000.00' },
        { method: 'transferencia', amount: '500.00' },
      ],
    });
  });

  it('ignora los medios vacíos', () => {
    expect(checkRefunds('100.00', mixed, { tarjeta: '', efectivo: '100' }).ok).toBe(true);
  });

  it.each([
    ['más que el tope del medio', '1000.00', { tarjeta: '1000.01' }, 'Por tarjeta se pueden devolver como máximo 1000.00'],
    ['efectivo por lo pagado con tarjeta (venta solo con tarjeta)', '500.00', { efectivo: '500' }, 'La venta no se pagó con efectivo'],
    ['no suman el valor', '1500.00', { tarjeta: '1000', transferencia: '400' }, 'suman 1400.00 y el valor de la devolución es 1500.00'],
    ['suman de más', '100.00', { tarjeta: '60', transferencia: '60' }, 'suman 120.00 y el valor de la devolución es 100.00'],
    ['cero', '100.00', { tarjeta: '0' }, 'mayor que cero'],
    ['negativo', '100.00', { tarjeta: '-5' }, 'mayor que cero'],
    ['3 decimales', '100.00', { tarjeta: '100.001' }, '2 decimales'],
    ['sin medios', '100.00', {}, 'Indica por qué medio'],
  ])('rechaza %s', (_name, total, entered, message) => {
    const payments = _name.startsWith('efectivo') ? [mixed[0]] : mixed;
    const result = checkRefunds(total, payments, entered);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toContain(message);
  });

  it('un medio ya devuelto por completo no admite más', () => {
    const spent = [{ ...mixed[0], refunded_amount: '1000.00' }];
    const result = checkRefunds('10.00', spent, { tarjeta: '10' });
    expect(!result.ok && result.error).toContain('como máximo 0.00');
  });
});

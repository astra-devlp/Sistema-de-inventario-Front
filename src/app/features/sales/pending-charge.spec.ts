import { HttpErrorResponse } from '@angular/common/http';
import { clearPendingCharge, isDefinitiveError, loadPendingCharge, pendingPayload, savePendingCharge } from './pending-charge';
import { SaleCreatePayload } from './sale.model';

const payload: SaleCreatePayload = {
  idempotency_key: 'clave-12345678',
  items: [{ product_id: 1, quantity: '2' }],
  payments: [
    { method: 'tarjeta', amount: '3000.00', reference: 'APR-123' },
    { method: 'efectivo', amount: '5000.00' },
  ],
  customer_id: null,
};

describe('cobro pendiente', () => {
  beforeEach(() => sessionStorage.clear());

  it('guarda la clave y el cuerpo, y los devuelve idénticos', () => {
    savePendingCharge(payload, 7);
    const pending = loadPendingCharge(7);
    expect(pending).not.toBeNull();
    expect(pendingPayload(pending!)).toEqual(payload);
  });

  it('vive en sessionStorage, nunca en localStorage', () => {
    localStorage.clear();
    savePendingCharge(payload, 7);
    expect(sessionStorage.length).toBe(1);
    expect(localStorage.length).toBe(0);
  });

  it('no guarda nada que no sea parte de la venta: ni credenciales ni campos ajenos', () => {
    const sneaky = { ...payload, authorization: { email: 'a@b.co', password: 'secreta' }, password: 'x' } as SaleCreatePayload;
    savePendingCharge(sneaky, 7);
    const raw = sessionStorage.getItem('inventario.pendingCharge')!;
    expect(raw).not.toContain('secreta');
    expect(raw).not.toContain('password');
    expect(raw).not.toContain('authorization');
    expect(Object.keys(JSON.parse(raw)).sort()).toEqual(['customer_id', 'idempotency_key', 'items', 'payments', 'saved_at', 'user_id']);
  });

  it('es de un usuario: otro usuario en la misma pestaña no lo ve', () => {
    savePendingCharge(payload, 7);
    expect(loadPendingCharge(8)).toBeNull();
    expect(loadPendingCharge(7)).not.toBeNull();
  });

  it('un nuevo cobro reemplaza al anterior', () => {
    savePendingCharge(payload, 7);
    savePendingCharge({ ...payload, idempotency_key: 'otra-clave-9999' }, 7);
    expect(loadPendingCharge(7)?.idempotency_key).toBe('otra-clave-9999');
  });

  it('clearPendingCharge lo borra', () => {
    savePendingCharge(payload, 7);
    clearPendingCharge();
    expect(loadPendingCharge(7)).toBeNull();
  });

  it('ignora lo dañado o con otra forma', () => {
    sessionStorage.setItem('inventario.pendingCharge', '{no es json');
    expect(loadPendingCharge(7)).toBeNull();
    sessionStorage.setItem('inventario.pendingCharge', JSON.stringify({ idempotency_key: 'x', items: [] }));
    expect(loadPendingCharge(7)).toBeNull();
    sessionStorage.setItem('inventario.pendingCharge', JSON.stringify({ ...payload, user_id: 7, saved_at: 'hoy', payments: [{ method: 'cheque', amount: '1' }] }));
    expect(loadPendingCharge(7)).toBeNull();
  });
});

describe('isDefinitiveError', () => {
  const http = (status: number) => new HttpErrorResponse({ status });

  it('un 4xx es definitivo: el servidor respondió y no vendió', () => {
    for (const status of [400, 403, 404, 409, 422, 429]) expect(isDefinitiveError(http(status))).toBe(true);
  });

  it('sin respuesta (red) o 5xx no es definitivo: la venta pudo haberse hecho', () => {
    for (const status of [0, 500, 502, 503, 504]) expect(isDefinitiveError(http(status))).toBe(false);
  });

  it('lo que no es una respuesta HTTP tampoco', () => {
    expect(isDefinitiveError(new Error('x'))).toBe(false);
  });
});

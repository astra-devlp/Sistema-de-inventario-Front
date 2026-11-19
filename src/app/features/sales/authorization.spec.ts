import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { returnErrorKind, returnRowErrors } from './return-errors';
import {
  WINDOW_EXPIRED_NOTICE,
  authErrorKind,
  authorizationPlan,
  formatCountdown,
  lockSeconds,
  remainingSeconds,
  voidConflictKind,
} from './authorization';
import { IdempotencyKeys, ReturnBody, returnFingerprint } from './idempotency';

const http = (status: number, detail?: unknown, headers?: Record<string, string>) =>
  new HttpErrorResponse({ status, error: detail === undefined ? null : { detail }, headers: headers ? new HttpHeaders(headers) : undefined });

describe('authorizationPlan: cuándo se pide el diálogo y a quién', () => {
  it('el Cajero siempre, de entrada, y autoriza un Supervisor o un Administrador', () => {
    for (const action of ['void', 'return'] as const) {
      expect(authorizationPlan('Usuario', action, false)).toEqual({ askUpFront: true, who: 'supervisor', notice: null });
    }
  });

  it('Supervisor y Administrador intentan primero sin credenciales (el diálogo sale solo si el API lo pide)', () => {
    for (const role of ['Supervisor', 'Administrador'] as const) {
      for (const action of ['void', 'return'] as const) expect(authorizationPlan(role, action, false).askUpFront).toBe(false);
    }
  });

  it('plazo vencido en una devolución: solo un Administrador; avisa antes de pedir credenciales', () => {
    expect(authorizationPlan('Usuario', 'return', true)).toEqual({ askUpFront: true, who: 'administrador', notice: WINDOW_EXPIRED_NOTICE });
    // un Supervisor no puede autorizar solo: se piden las de un Administrador de entrada
    expect(authorizationPlan('Supervisor', 'return', true)).toEqual({ askUpFront: true, who: 'administrador', notice: WINDOW_EXPIRED_NOTICE });
    // un Administrador se autoriza solo
    expect(authorizationPlan('Administrador', 'return', true)).toEqual({ askUpFront: false, who: 'administrador', notice: WINDOW_EXPIRED_NOTICE });
  });

  it('el plazo no cuenta para anular', () => {
    expect(authorizationPlan('Supervisor', 'void', true)).toEqual({ askUpFront: false, who: 'supervisor', notice: null });
  });
});

describe('authErrorKind: los 403 no cierran sesión ni revelan el motivo', () => {
  it('distingue «requiere autorización», «no válida» y el 429', () => {
    expect(authErrorKind(http(403, 'Esta operación requiere la autorización de un supervisor'))).toBe('required');
    expect(authErrorKind(http(403, 'Autorización no válida'))).toBe('invalid');
    expect(authErrorKind(http(429, 'Demasiados intentos', { 'Retry-After': '120' }))).toBe('rate_limited');
  });

  it('otros errores no son de autorización', () => {
    expect(authErrorKind(http(403, { code: 'plan_vencido' }))).toBe('none');
    expect(authErrorKind(http(409, 'La venta ya está anulada'))).toBe('none');
    expect(authErrorKind(http(0))).toBe('none');
    expect(authErrorKind(new Error('x'))).toBe('none');
  });
});

describe('cuenta atrás del 429', () => {
  it('usa Retry-After; sin la cabecera, 60 s', () => {
    expect(lockSeconds(http(429, 'x', { 'Retry-After': '300' }))).toBe(300);
    expect(lockSeconds(http(429, 'x'))).toBe(60);
    expect(lockSeconds(http(429, 'x', { 'Retry-After': 'pronto' }))).toBe(60);
    expect(lockSeconds(http(429, 'x', { 'Retry-After': '0' }))).toBe(60);
  });

  it('cuenta los segundos que faltan, redondeando hacia arriba y sin bajar de cero', () => {
    const until = 1_000_000 + 90_000;
    expect(remainingSeconds(until, 1_000_000)).toBe(90);
    expect(remainingSeconds(until, 1_000_000 + 89_100)).toBe(1);
    expect(remainingSeconds(until, until)).toBe(0);
    expect(remainingSeconds(until, until + 5000)).toBe(0);
  });

  it('formatea m:ss', () => {
    expect(formatCountdown(300)).toBe('5:00');
    expect(formatCountdown(65)).toBe('1:05');
    expect(formatCountdown(9)).toBe('0:09');
    expect(formatCountdown(0)).toBe('0:00');
  });
});

describe('voidConflictKind: los tres 409 distintos de anular', () => {
  it('los distingue por su texto', () => {
    expect(voidConflictKind(http(409, 'La venta ya está anulada'))).toBe('already_voided');
    expect(voidConflictKind(http(409, 'El turno de esta venta ya está cerrado: no se puede anular. Haz una devolución total'))).toBe('shift_closed');
    expect(voidConflictKind(http(409, 'La venta ya tiene devoluciones: no se puede anular. Devuelve lo que falta'))).toBe('has_returns');
    expect(voidConflictKind(http(409, 'otra cosa'))).toBe('other');
    expect(voidConflictKind(http(422, 'La venta ya está anulada'))).toBe('other');
  });
});

describe('returnErrorKind', () => {
  const rows = { message: 'x', errors: [{ index: 0, sale_line_id: 31, code: 'supera_lo_vendido', reason: 'Se vendieron 2 y ya se devolvieron 1: se pueden devolver 1, no 2', sold: '2', returned: '1', available: '1' }] };

  it('autorización', () => {
    expect(returnErrorKind(http(403, 'Esta operación requiere la autorización de un supervisor'))).toBe('auth_required');
    expect(returnErrorKind(http(403, 'Autorización no válida'))).toBe('auth_invalid');
    expect(returnErrorKind(http(429, 'x'))).toBe('rate_limited');
  });

  it('los 409', () => {
    expect(returnErrorKind(http(409, rows))).toBe('excess');
    expect(returnErrorKind(http(409, 'No tienes un turno abierto: abre un turno en una caja de la sede de la venta para registrar la devolución'))).toBe('no_shift');
    expect(returnErrorKind(http(409, 'La devolución debe hacerse en una caja de la sede donde se hizo la venta'))).toBe('other_location');
    expect(returnErrorKind(http(409, 'La venta está anulada: no admite devoluciones'))).toBe('voided');
    expect(returnErrorKind(http(409, 'La clave de idempotencia ya se usó en otra devolución: genera una clave nueva para esta'))).toBe('key_reused');
    expect(returnErrorKind(http(409, 'Por efectivo se pagaron 0.00 en esta venta y ya se devolvieron 0.00: por ese medio se pueden devolver como máximo 0.00'))).toBe('refund_cap');
  });

  it('los 422', () => {
    expect(returnErrorKind(http(422, { message: 'x', errors: [{ index: 1, reason: 'Cantidad inválida', code: 'cantidad_invalida' }] }))).toBe('rows');
    expect(returnErrorKind(http(422, 'Los reembolsos suman 2629.99 y el valor de la devolución es 2630.00: deben coincidir'))).toBe('refund_sum');
    expect(returnErrorKind(http(500))).toBe('other');
  });

  it('el error de cada renglón conserva el motivo de la API, indexado desde 0', () => {
    const map = returnRowErrors(http(409, rows));
    expect([...map.keys()]).toEqual([0]);
    expect(map.get(0)).toContain('se pueden devolver 1, no 2');
  });
});

describe('idempotencia de la devolución (misma lógica que la venta)', () => {
  const body: ReturnBody = {
    sale_id: 5,
    items: [
      { sale_line_id: 31, quantity: '2', restock: true },
      { sale_line_id: 32, quantity: '0.250', restock: false },
    ],
    refunds: [{ method: 'efectivo', amount: '2630.00' }],
    reason: 'El cliente cambió de opinión',
  };
  const counter = () => {
    let n = 0;
    return () => `dev-${++n}`;
  };
  const make = () => new IdempotencyKeys<ReturnBody>(counter(), returnFingerprint);

  it('misma clave con un cuerpo idéntico, aunque se escriba distinto', () => {
    const keys = make();
    const first = keys.keyFor(body);
    expect(keys.keyFor(structuredClone(body))).toBe(first);
    const rewritten: ReturnBody = {
      ...body,
      items: [{ ...body.items[0], quantity: '2.000' }, { ...body.items[1], quantity: '0.25' }],
      refunds: [{ method: 'efectivo', amount: '2630' }],
      reason: '  El cliente cambió de opinión  ',
    };
    expect(keys.keyFor(rewritten)).toBe(first);
  });

  it.each<[string, ReturnBody]>([
    ['otra cantidad', { ...body, items: [{ ...body.items[0], quantity: '1' }, body.items[1]] }],
    ['otro restock', { ...body, items: [body.items[0], { ...body.items[1], restock: true }] }],
    ['otro reembolso', { ...body, refunds: [{ method: 'tarjeta', amount: '2630.00' }] }],
    ['otro monto', { ...body, refunds: [{ method: 'efectivo', amount: '2629.99' }] }],
    ['otro motivo', { ...body, reason: 'Llegó abierto' }],
    ['otra venta', { ...body, sale_id: 6 }],
  ])('clave nueva con %s', (_name, other) => {
    const keys = make();
    const first = keys.keyFor(body);
    expect(keys.keyFor(other)).not.toBe(first);
  });

  it('se renueva tras una devolución confirmada', () => {
    const keys = make();
    const first = keys.keyFor(body);
    keys.renew();
    expect(keys.keyFor(body)).not.toBe(first);
  });

  it('la autorización no forma parte de la huella: cambiar de supervisor no cambia la clave', () => {
    expect(returnFingerprint(body)).toBe(returnFingerprint({ ...body }));
    expect(Object.keys(body)).not.toContain('authorization');
  });
});

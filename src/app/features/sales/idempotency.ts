import { centsToMoney, moneyToCents } from './sale-math';
import { SaleCreatePayload } from './sale.model';

type Body = Omit<SaleCreatePayload, 'idempotency_key'>;

function quantityKey(value: string): string {
  const [int, frac = ''] = value.trim().split('.');
  const cleanFrac = frac.replace(/0+$/, '');
  return `${int.replace(/^0+(?=\d)/, '')}${cleanFrac ? `.${cleanFrac}` : ''}`;
}

/**
 * Huella del contenido, normalizada como `request_hash` del back: `1` y `1.000`, o `50` y `50.00`, son lo mismo;
 * los renglones conservan su orden y los pagos no importan en qué orden vengan.
 */
export function requestFingerprint(body: Body): string {
  return JSON.stringify({
    items: body.items.map((item) => [item.product_id, quantityKey(item.quantity)]),
    payments: body.payments
      .map((payment) => [payment.method, centsToMoney(moneyToCents(payment.amount)), payment.reference ?? ''])
      .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
    customer_id: body.customer_id,
  });
}

/** UUID para `idempotency_key`: 8 a 64 caracteres de letras, números, `-` y `_`. */
export function newIdempotencyKey(): string {
  return crypto.randomUUID();
}

/**
 * Clave de idempotencia por intento de cobro. La misma clave solo se reutiliza si el cuerpo es idéntico (reintento
 * tras un fallo de red o un 5xx): con otro contenido el back responde 409 a la clave repetida, así que si el carrito
 * o los pagos cambian se genera una nueva. Tras una venta confirmada se renueva.
 */
export class IdempotencyKeys<T = Body> {
  private key: string | null = null;
  private fingerprint: string | null = null;

  constructor(
    private readonly generate: () => string = newIdempotencyKey,
    private readonly fingerprintOf: (body: T) => string = requestFingerprint as unknown as (body: T) => string,
  ) {}

  /** La clave para enviar este cuerpo. */
  keyFor(body: T): string {
    const fingerprint = this.fingerprintOf(body);
    if (this.key === null || this.fingerprint !== fingerprint) {
      this.key = this.generate();
      this.fingerprint = fingerprint;
    }
    return this.key;
  }

  /** Operación confirmada (201 o 200): la siguiente empieza con una clave nueva. */
  renew(): void {
    this.key = null;
    this.fingerprint = null;
  }
}

/** Contenido de una devolución, sin la autorización: quién autoriza no cambia la petición. */
export interface ReturnBody {
  sale_id: number;
  items: { sale_line_id: number; quantity: string; restock: boolean }[];
  refunds: { method: string; amount: string }[];
  reason: string;
}

/** Huella como `return_request_hash` del back: cantidades y montos normalizados, motivo sin espacios de los bordes. */
export function returnFingerprint(body: ReturnBody): string {
  return JSON.stringify({
    sale_id: body.sale_id,
    items: body.items.map((item) => [item.sale_line_id, quantityKey(item.quantity), item.restock]),
    refunds: body.refunds.map((refund) => [refund.method, centsToMoney(moneyToCents(refund.amount))]).sort((a, b) => a[0].localeCompare(b[0])),
    reason: body.reason.trim(),
  });
}

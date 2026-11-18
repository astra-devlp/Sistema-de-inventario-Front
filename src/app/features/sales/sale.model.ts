import type { PaymentMethod } from './sale-math';

/** `PosProductSchema`: `stock` y `location_id` solo vienen con turno abierto. El stock es informativo. */
export interface PosProduct {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  brand: string | null;
  unit_id: number;
  tax_id: number | null;
  price_with_tax: string;
  stock?: string;
}

export type MatchKind = 'code' | 'sku' | 'name' | 'none';

export interface LookupResponse {
  match: MatchKind;
  items: PosProduct[];
  has_more: boolean;
  location_id?: number;
}

export interface SaleItemPayload {
  product_id: number;
  quantity: string;
}

export interface SalePaymentPayload {
  method: PaymentMethod;
  amount: string;
  reference?: string;
}

/** Cuerpo cerrado de `POST /sales`: sin precios, totales, sede ni caja. */
export interface SaleCreatePayload {
  idempotency_key: string;
  items: SaleItemPayload[];
  payments: SalePaymentPayload[];
  customer_id: number | null;
}

export interface Issuer {
  name: string | null;
  legal_name: string | null;
  tax_id: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

export interface SaleLine {
  id: number;
  line_number: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  unit_price_with_tax: string;
  tax_name: string | null;
  tax_rate: string;
  is_exempt: boolean;
  line_base: string;
  line_tax: string;
  line_total: string;
}

export interface SalePayment {
  method: PaymentMethod;
  /** Lo aplicado a la venta. */
  amount: string;
  /** Efectivo entregado por el cliente. */
  received: string | null;
  reference: string | null;
}

export interface TaxSummary {
  tax_name: string | null;
  tax_rate: string;
  is_exempt: boolean;
  base: string;
  tax: string;
}

export interface Sale {
  id: number;
  document_type: string;
  legal_notice: string;
  /** Puede venir con todo en `null` en recibos anteriores a la copia de datos. */
  issuer: Issuer | null;
  receipt_code: string;
  status: string;
  created_at: string;
  customer: { id: number; name: string; document_type: string | null; document: string | null } | null;
  lines: SaleLine[];
  payments: SalePayment[];
  subtotal: string;
  tax_total: string;
  total: string;
  change_amount: string;
  taxes: TaxSummary[];
  voided_at: string | null;
}

/** 201: venta nueva. 200: la misma venta ya creada (reintento con la misma clave). */
export interface SaleCreated {
  sale: Sale;
  replay: boolean;
}

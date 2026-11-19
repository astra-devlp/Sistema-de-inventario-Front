import type { PaymentMethod } from './sale-math';
import type { Issuer } from './sale.model';

export interface ReturnItemPayload {
  sale_line_id: number;
  quantity: string;
  /** Obligatorio, sin valor por defecto: `true` vuelve al stock; `false` es mal estado (merma). */
  restock: boolean;
}

export interface ReturnRefundPayload {
  method: PaymentMethod;
  amount: string;
}

/** Credenciales de quien autoriza. Solo viajan en la petición: no se guardan en ningún estado ni almacenamiento. */
export interface AuthorizationPayload {
  email: string;
  password: string;
}

export interface ReturnCreatePayload {
  idempotency_key: string;
  items: ReturnItemPayload[];
  refunds: ReturnRefundPayload[];
  reason: string;
  authorization?: AuthorizationPayload;
}

export interface SaleReturnLine {
  id: number;
  sale_line_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  quantity: string;
  restock: boolean;
  unit_price_with_tax: string;
  tax_name: string | null;
  tax_rate: string;
  tax_amount: string;
  amount: string;
}

export interface SaleReturn {
  id: number;
  document_type: string;
  legal_notice: string;
  issuer: Issuer | null;
  return_code: string;
  sale_id: number;
  sale_receipt_code: string;
  created_at: string;
  shift_id: number;
  location_id: number;
  user_id: number;
  authorized_by_user_id: number;
  reason: string;
  lines: SaleReturnLine[];
  refunds: { method: PaymentMethod; amount: string }[];
  tax_total: string;
  total: string;
}

/** 201: devolución nueva. 200: la misma ya creada (reintento con la misma clave). */
export interface ReturnCreated {
  saleReturn: SaleReturn;
  replay: boolean;
}

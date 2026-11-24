/** Medios con los que se recibe un abono: nunca a crédito. */
export type PaymentMethodForCredit = 'efectivo' | 'tarjeta' | 'transferencia';

export interface CustomerPayment {
  id: number;
  customer_id: number;
  shift_id: number;
  user_id: number;
  method: PaymentMethodForCredit;
  amount: string;
  received: string | null;
  change: string;
  note: string | null;
  created_at: string;
}

export interface CreditSale {
  sale_id: number;
  receipt_code: string;
  created_at: string;
  credit: string;
  refunded: string;
}

/** `GET /customers/{id}/account`: el saldo lo calcula el back (fiado − devuelto al crédito − abonos). */
export interface CustomerAccount {
  customer_id: number;
  balance: string;
  credit_sales: CreditSale[];
  payments: CustomerPayment[];
}

export interface CustomerPaymentBody {
  method: PaymentMethodForCredit;
  amount: string;
  received?: string;
  note?: string;
}

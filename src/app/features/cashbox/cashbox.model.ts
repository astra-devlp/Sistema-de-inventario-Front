export type ShiftStatus = 'open' | 'closed';
export type PaymentMethod = 'cash' | 'card' | 'transfer' | 'credit';
export type SaleKind = 'sale' | 'credit_payment';

export interface AmountLine {
  key: string;
  label: string;
  amount: number;
}

export interface CashShift {
  id: number;
  opened_by_user_id: number;
  opened_by_email: string;
  opened_by_name: string;
  opening_cash: number;
  counted_cash: number | null;
  status: ShiftStatus;
  opened_at: string;
  closed_at: string | null;
  notes: string | null;
}

export interface CashboxDashboard {
  shift: CashShift | null;
  cash_income: number;
  shift_sales: number;
  sales_count: number;
  expected_cash: number;
  difference: number | null;
  by_payment: AmountLine[];
  credit_payments: AmountLine[];
  by_category: AmountLine[];
  history: CashShift[];
}

export interface OpenShiftPayload {
  opening_cash: number;
}

export interface CloseShiftPayload {
  counted_cash: number;
  notes?: string | null;
}

export interface RegisterSalePayload {
  kind: SaleKind;
  payment_method: PaymentMethod;
  amount: number;
  category?: string | null;
}

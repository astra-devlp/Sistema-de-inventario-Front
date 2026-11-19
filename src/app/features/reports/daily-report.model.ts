/** `GET /cash-reports/daily`. Los montos son cadenas decimales y pueden llegar como `"0"` o `"0.00"`, con signo. */
export interface MethodAmounts {
  efectivo: string;
  tarjeta: string;
  transferencia: string;
}

export interface Flow {
  count: number;
  total: string;
  by_method: MethodAmounts;
}

export interface Net {
  total: string;
  by_method: MethodAmounts;
}

/** Ventas, anulaciones, devoluciones y neto de un grupo: la sede, una caja o un turno. */
export interface ReportSection {
  sales: Flow;
  voids: Flow;
  returns: Flow;
  net: Net;
}

export interface RegisterReport extends ReportSection {
  cash_register_id: number;
  code: string;
  name: string;
}

export interface ShiftReport extends ReportSection {
  shift_id: number;
  cash_register_id: number;
  register_code: string;
  user_id: number;
  user_name: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  closed_by_user_id: number | null;
  forced_close: boolean;
  crosses_midnight: boolean;
  opening_cash: string;
  /** Del turno completo, no del día. `null` mientras está abierto. */
  expected_cash: string | null;
  counted_cash: string | null;
  difference: string | null;
}

export interface DailyReport extends ReportSection {
  location_id: number;
  location_name: string;
  date: string;
  timezone: string;
  closed_shifts_count: number;
  closed_shifts_difference: string;
  registers: RegisterReport[];
  shifts: ShiftReport[];
}

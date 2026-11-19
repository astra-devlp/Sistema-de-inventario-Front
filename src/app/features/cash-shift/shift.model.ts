/** `ShiftResponseSchema` del back. Los montos son cadenas decimales (`"50000.00"`). */
export interface Shift {
  id: number;
  cash_register_id: number;
  location_id: number;
  /** Dueño del turno: quien lo abrió. */
  user_id: number;
  opening_cash: string;
  opened_at: string;
  status: 'abierto' | 'cerrado';
  closed_at: string | null;
  closed_by_user_id: number | null;
  /** `true` si lo cerró alguien distinto de su dueño (Supervisor o Administrador). */
  forced_close: boolean;
  /** `null` mientras el turno está abierto: la API no lo entrega hasta el cierre. No se calcula en el front. */
  expected_cash: string | null;
  counted_cash: string | null;
  /** Contado − esperado: positivo sobra, negativo falta. */
  difference: string | null;
  note: string | null;
}

export interface ShiftOpenPayload {
  cash_register_id: number;
  opening_cash: string;
}

export interface ShiftClosePayload {
  counted_cash: string;
  note: string | null;
}

export interface ShiftFilters {
  status: 'abierto' | 'cerrado' | '';
  limit: number;
  offset: number;
}

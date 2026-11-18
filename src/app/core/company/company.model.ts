/** `GET /companies/me`. El plan `null` es una empresa sin vencimiento. */
export interface Company {
  id: number;
  name: string;
  tax_id: string | null;
  legal_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  is_active: boolean;
  default_tax_id: number | null;
  return_window_days: number;
  plan: 'prueba' | 'mensual' | 'anual' | null;
  plan_expires_at: string | null;
  plan_expired: boolean;
}

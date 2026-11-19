import type { Company } from '@core/company/company.model';
import type { Tax, Unit, UnitType } from '@features/products/catalog.model';

export type Plan = 'prueba' | 'mensual' | 'anual';

/** `GET /platform/companies`: lo mismo que `/companies/me` más las fechas de la fila. */
export type PlatformCompany = Company & { created_at: string; updated_at: string };

/** `PUT /platform/companies/{id}/plan`: los dos con valor, o los dos `null` (sin vencimiento). */
export interface PlanBody {
  plan: Plan | null;
  plan_expires_at: string | null;
}

/** `POST /platform/companies`. La contraseña inicial solo existe en este objeto, armado al enviar. */
export interface CompanyCreateBody {
  name: string;
  tax_id: string | null;
  legal_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  plan: Plan;
  plan_expires_at: string;
  admin_name: string;
  admin_email: string;
  admin_password: string;
}

/** `PATCH /platform/companies/{id}`: es cerrado; el plan va por `PUT …/plan`. */
export interface CompanyPatchBody {
  name: string;
  tax_id: string | null;
  legal_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
}

export interface UnitBody {
  name: string;
  abbreviation: string;
  unit_type: UnitType;
}

/** El IVA ya no lleva `is_default`: `POST` lo ignora y `PATCH` responde 422. */
export interface TaxBody {
  name: string;
  rate: string;
  is_exempt: boolean;
}

export type { Tax, Unit };

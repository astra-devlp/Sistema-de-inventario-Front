import { HttpErrorResponse } from '@angular/common/http';
import { httpErrorMessage } from '@core/api/api-error';
import type { Company } from '@core/company/company.model';
import { UNIT_TYPES, UnitType } from '@features/products/catalog.model';
import { CompanyCreateBody, CompanyPatchBody, Plan, PlanBody, TaxBody, UnitBody } from './platform.model';

export const PLANS: { value: Plan; label: string }[] = [
  { value: 'prueba', label: 'Prueba' },
  { value: 'mensual', label: 'Mensual' },
  { value: 'anual', label: 'Anual' },
];

export const PLAN_LABELS: Record<Plan, string> = { prueba: 'Prueba', mensual: 'Mensual', anual: 'Anual' };

export const PLAN_END_NOTE = 'El plan vence al final del día (hora de Bogotá) de esa fecha.';

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

// ---- NIT -------------------------------------------------------------------------------------------------

const NIT = /^\d{6,10}(-\d)?$/;
export const NIT_ERROR = 'El NIT debe tener de 6 a 10 dígitos y, opcionalmente, un guion y el dígito de verificación';

/**
 * Igual que `normalize_nit` del back: sin puntos ni espacios (`900.123.456-7` → `900123456-7`), vacío es `null`, y
 * de 6 a 10 dígitos con guion y dígito de verificación opcionales. La API sigue siendo quien decide.
 */
export function normalizeNit(raw: string | null | undefined): Result<string | null> {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  const compact = raw.replace(/[.\s]/g, '');
  if (!compact) return { ok: true, value: null };
  if (!NIT.test(compact)) return { ok: false, error: NIT_ERROR };
  return { ok: true, value: compact };
}

// ---- Plan ------------------------------------------------------------------------------------------------

export type PlanState = 'vigente' | 'vencido' | 'sin_vencimiento';

export const PLAN_STATE_LABELS: Record<PlanState, string> = {
  vigente: 'Vigente',
  vencido: 'Vencido',
  sin_vencimiento: 'Sin vencimiento',
};

/** Estado del plan. `plan_expired` lo calcula la API con la regla del día de Bogotá; el front no la repite. */
export function planState(company: Pick<Company, 'plan' | 'plan_expires_at' | 'plan_expired'>): PlanState {
  if (company.plan === null && company.plan_expires_at === null) return 'sin_vencimiento';
  return company.plan_expired ? 'vencido' : 'vigente';
}

/** Fecha de calendario en Bogotá (`YYYY-MM-DD`) de un instante. Colombia no tiene horario de verano: UTC−5. */
export function bogotaDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return null;
  return new Date(time - 5 * 3600 * 1000).toISOString().slice(0, 10);
}

/** `2026-11-18` → `18/11/2026`, sin pasar por `Date` (no hay corrimiento de zona). */
export function formatDay(date: string | null): string {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export function isValidDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** El vencimiento se envía con zona horaria: el último segundo del día de Bogotá de esa fecha. */
export function expiryAt(day: string): string {
  return `${day}T23:59:59-05:00`;
}

const PLAN_VALUES = new Set<string>(PLANS.map((p) => p.value));

/**
 * Cuerpo de la renovación: plan y vencimiento van juntos. Los dos vacíos dejan la empresa sin vencimiento (ambos
 * `null`); uno solo es un error, como el 422 del back.
 */
export function planBody(plan: string, day: string): Result<PlanBody> {
  const hasPlan = plan.trim() !== '';
  const hasDay = day.trim() !== '';
  if (!hasPlan && !hasDay) return { ok: true, value: { plan: null, plan_expires_at: null } };
  if (hasPlan !== hasDay) return { ok: false, error: 'El plan y su vencimiento van juntos: elige los dos o deja los dos vacíos' };
  if (!PLAN_VALUES.has(plan)) return { ok: false, error: 'Elige un plan válido' };
  if (!isValidDay(day)) return { ok: false, error: 'Elige una fecha de vencimiento válida' };
  return { ok: true, value: { plan: plan as Plan, plan_expires_at: expiryAt(day) } };
}

// ---- Empresa ---------------------------------------------------------------------------------------------

function textOrNull(raw: string): string | null {
  const text = raw.trim();
  return text === '' ? null : text;
}

export interface CompanyFormInput {
  name: string;
  tax_id: string;
  legal_name: string;
  phone: string;
  address: string;
  city: string;
}

export interface CompanyCreateInput extends CompanyFormInput {
  plan: string;
  expires_on: string;
  admin_name: string;
  admin_email: string;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

/**
 * Cuerpo del alta: exige plan y vencimiento y crea el primer Administrador. La contraseña llega como argumento, en
 * el momento de enviar: no vive en ningún formulario, señal ni almacenamiento.
 */
export function createCompanyBody(input: CompanyCreateInput, adminPassword: string): Result<CompanyCreateBody> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'El nombre comercial es obligatorio' };
  const nit = normalizeNit(input.tax_id);
  if (!nit.ok) return nit;
  if (!input.plan.trim() || !input.expires_on.trim()) {
    return { ok: false, error: 'El plan y su vencimiento son obligatorios al crear la empresa' };
  }
  const plan = planBody(input.plan, input.expires_on);
  if (!plan.ok) return plan;
  const adminName = input.admin_name.trim();
  if (!adminName) return { ok: false, error: 'El nombre del Administrador es obligatorio' };
  const email = input.admin_email.trim();
  if (!EMAIL.test(email)) return { ok: false, error: 'Escribe un correo válido para el Administrador' };
  if (adminPassword.length < PASSWORD_MIN || adminPassword.length > PASSWORD_MAX) {
    return { ok: false, error: `La contraseña inicial debe tener entre ${PASSWORD_MIN} y ${PASSWORD_MAX} caracteres` };
  }
  return {
    ok: true,
    value: {
      name,
      tax_id: nit.value,
      legal_name: textOrNull(input.legal_name),
      phone: textOrNull(input.phone),
      address: textOrNull(input.address),
      city: textOrNull(input.city),
      plan: plan.value.plan as Plan,
      plan_expires_at: plan.value.plan_expires_at as string,
      admin_name: adminName,
      admin_email: email,
      admin_password: adminPassword,
    },
  };
}

/** Cuerpo de `PATCH /platform/companies/{id}`: nombre comercial, razón social, NIT, teléfono, dirección y ciudad. */
export function companyPatchBody(input: CompanyFormInput): Result<CompanyPatchBody> {
  const name = input.name.trim();
  if (!name) return { ok: false, error: 'El nombre comercial es obligatorio' };
  const nit = normalizeNit(input.tax_id);
  if (!nit.ok) return nit;
  return {
    ok: true,
    value: {
      name,
      tax_id: nit.value,
      legal_name: textOrNull(input.legal_name),
      phone: textOrNull(input.phone),
      address: textOrNull(input.address),
      city: textOrNull(input.city),
    },
  };
}

// ---- Unidades e IVA --------------------------------------------------------------------------------------

export function unitBody(name: string, abbreviation: string, unitType: string): Result<UnitBody> {
  if (!name.trim()) return { ok: false, error: 'El nombre es obligatorio' };
  if (!abbreviation.trim()) return { ok: false, error: 'La abreviatura es obligatoria' };
  if (!(UNIT_TYPES as readonly string[]).includes(unitType)) return { ok: false, error: 'Elige un tipo de unidad' };
  return { ok: true, value: { name: name.trim(), abbreviation: abbreviation.trim(), unit_type: unitType as UnitType } };
}

const RATE = /^\d{1,3}(?:\.\d{1,2})?$/;

/** Tarifa de IVA: el porcentaje viaja como texto decimal (0 a 100, hasta 2 decimales); exento es 0. */
export function taxBody(name: string, rate: string, exempt: boolean): Result<TaxBody> {
  if (!name.trim()) return { ok: false, error: 'El nombre es obligatorio' };
  if (exempt) return { ok: true, value: { name: name.trim(), rate: '0', is_exempt: true } };
  const text = rate.trim().replace(',', '.');
  if (!RATE.test(text) || Number(text) > 100) return { ok: false, error: 'El porcentaje debe estar entre 0 y 100, con hasta 2 decimales' };
  return { ok: true, value: { name: name.trim(), rate: text, is_exempt: false } };
}

// ---- Errores ---------------------------------------------------------------------------------------------

export type PlatformErrorKind = 'conflict' | 'not_found' | 'validation' | 'forbidden' | 'other';

/** Qué respondió la API. Ninguno cierra la sesión: solo el 401 lo hace. */
export function platformErrorKind(error: unknown): PlatformErrorKind {
  if (!(error instanceof HttpErrorResponse)) return 'other';
  if (error.status === 409) return 'conflict';
  if (error.status === 404) return 'not_found';
  if (error.status === 422) return 'validation';
  if (error.status === 403) return 'forbidden';
  return 'other';
}

/** El `detail` de la API tal cual (un IVA en uso no puede cambiar su tarifa, una unidad en uso no se borra…). */
export function platformErrorMessage(error: unknown, fallback: string): string {
  return httpErrorMessage(error, fallback);
}

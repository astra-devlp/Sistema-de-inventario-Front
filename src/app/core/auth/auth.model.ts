export type UserRole =
  | 'Administrador'
  | 'Administrador de plataforma'
  | 'Cliente'
  | 'Usuario';

export type ClientPlan = 'Prueba' | 'Mensual' | 'Anual';

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  plan: ClientPlan | null;
  plan_starts_at: string | null;
  plan_ends_at: string | null;
  /** Empresa del usuario; `null` para el administrador de plataforma. */
  company_id: number | null;
  /** Solo rol Usuario: id del Cliente dueño del negocio. */
  account_owner_id: number | null;
  /** Solo rol Cliente: datos del local en facturas. */
  business_name: string | null;
  business_nit: string | null;
  business_phone: string | null;
  business_address: string | null;
  business_city: string | null;
}

/** Ruta de entrada según rol. */
export function homePathForRole(role: UserRole | null | undefined): string {
  if (role === 'Usuario') return '/cierre-caja';
  return '/inicio';
}

/**
 * Texto bajo el nombre en UI (topbar, Mi cuenta).
 * Cliente/Usuario: nombre de la tienda (no el rol interno).
 * Admin: el rol.
 */
export function userContextLabel(user: AuthUser | null | undefined): string {
  if (!user) return '—';
  if (user.role === 'Cliente' || user.role === 'Usuario') {
    const store = user.business_name?.trim();
    return store || 'Mi tienda';
  }
  return user.role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

/** Solo Administrador ve Administración → Cuentas. */
export const PLATFORM_ADMIN_ROLES: UserRole[] = ['Administrador'];
/** Roles visibles en la tabla de Cuentas (incluye legacy Admin de plataforma). */
export const ACCOUNT_ROLES: UserRole[] = [
  'Administrador',
  'Administrador de plataforma',
  'Cliente',
];
/** Roles que se pueden crear/asignar desde el formulario. */
export const ACCOUNT_CREATE_ROLES: UserRole[] = ['Administrador', 'Cliente'];
export const CLIENT_PLANS: ClientPlan[] = ['Prueba', 'Mensual', 'Anual'];

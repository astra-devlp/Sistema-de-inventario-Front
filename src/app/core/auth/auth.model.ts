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
  /** Solo rol Usuario: id del Cliente dueño del negocio. */
  account_owner_id: number | null;
}

/** Ruta de entrada según rol. */
export function homePathForRole(role: UserRole | null | undefined): string {
  if (role === 'Usuario') return '/cierre-caja';
  return '/inicio';
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

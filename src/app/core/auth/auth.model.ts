import type { Company } from '@core/company/company.model';

/** Valores exactos que guarda y devuelve la API en `role`. No existe un rol «Cliente». */
export type UserRole = 'Administrador de plataforma' | 'Administrador' | 'Supervisor' | 'Usuario';

/** Dueño del software: sin empresa, solo opera `/platform/*`; en los endpoints de negocio recibe 403. */
export const PLATFORM_ROLE: UserRole = 'Administrador de plataforma';

/** Roles de una empresa (los que se pueden crear y asignar desde Usuarios). */
export const COMPANY_ROLES: UserRole[] = ['Administrador', 'Supervisor', 'Usuario'];

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone: string | null;
  is_active: boolean;
  /** Empresa del usuario; `null` para el administrador de plataforma. */
  company_id: number | null;
  created_at: string;
  updated_at: string;
}

/** Etiqueta para mostrar. «Cajero» es solo del front: el valor que viaja en `role` sigue siendo `Usuario`. */
export function roleLabel(role: UserRole): string {
  return role === 'Usuario' ? 'Cajero' : role;
}

/**
 * Ruta de entrada según rol. Mientras la caja no exista, el personal de empresa entra a Productos;
 * el administrador de plataforma, a su pantalla (la API de negocio le responde 403).
 */
export function homePathForRole(role: UserRole | null | undefined): string {
  return role === PLATFORM_ROLE ? '/plataforma' : '/venta';
}

/** Texto bajo el nombre en UI (topbar, Mi cuenta): «Empresa · Rol». */
export function userContextLabel(user: AuthUser | null | undefined, company: Company | null | undefined): string {
  if (!user) return '—';
  if (user.role === PLATFORM_ROLE) return user.role;
  const name = company?.name.trim();
  return name ? `${name} · ${roleLabel(user.role)}` : roleLabel(user.role);
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: AuthUser;
}

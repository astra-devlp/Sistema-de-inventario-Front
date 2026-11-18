import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthUser, LoginResponse, PLATFORM_ADMIN_ROLES, homePathForRole } from './auth.model';

const TOKEN_KEY = 'inventario.token';
const USER_KEY = 'inventario.user';

/** Lee `exp` (segundos) del JWT sin verificarlo: la firma la valida siempre el backend. */
function tokenExpiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AuthUser | null>(this.readUser());

  readonly user = this.current.asReadonly();

  token(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    const token = this.token();
    if (token === null || this.current() === null) return false;
    const expiresAt = tokenExpiresAt(token);
    if (expiresAt !== null && expiresAt <= Date.now()) {
      this.logout();
      return false;
    }
    return true;
  }

  /** Administradores de la plataforma: ven el panel Administración → Cuentas. */
  isAdmin(): boolean {
    const role = this.current()?.role;
    return role != null && PLATFORM_ADMIN_ROLES.includes(role);
  }

  /** Dueño de la cuenta del cliente: gestiona el personal en Usuarios. */
  isClient(): boolean {
    return this.current()?.role === 'Cliente';
  }

  canManageStaff(): boolean {
    return this.isAdmin() || this.isClient();
  }

  /** Inicio del panel: Usuario → caja; Admin/Cliente → asesoría contable. */
  homePath(): string {
    return homePathForRole(this.current()?.role);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(`${API_URL}/users/login`, { email, password })
      .pipe(tap((response) => this.persist(response)));
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.current.set(null);
  }

  /** Actualiza el usuario guardado en sesión (por ejemplo tras editar la cuenta). */
  setUser(user: AuthUser): void {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    this.current.set(user);
  }

  private persist(response: LoginResponse): void {
    localStorage.setItem(TOKEN_KEY, response.access_token);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    this.current.set(response.user);
  }

  private readUser(): AuthUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw || !localStorage.getItem(TOKEN_KEY)) return null;
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  }
}

export function httpErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    // Sin respuesta: la API está apagada, no es alcanzable o rechazó el origen (CORS).
    if (error.status === 0) {
      return `${fallback}. No hay conexión con la API; revisa que el backend esté encendido (http://127.0.0.1:8000)`;
    }
    const detail = error.error?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    // FastAPI devuelve los errores de validación (422) como una lista de { loc, msg }.
    if (Array.isArray(detail) && detail.length) {
      const fields = detail
        .map((item) => (Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null))
        .filter((field): field is string => typeof field === 'string');
      if (fields.length) return `${fallback}. Revisa: ${[...new Set(fields)].join(', ')}`;
    }
    if (error.status === 401) {
      return `${fallback}. Sesión vencida o inválida: cierra sesión y vuelve a entrar`;
    }
    if (error.status >= 500) return `${fallback}. Error del servidor (${error.status})`;
  }
  return fallback;
}

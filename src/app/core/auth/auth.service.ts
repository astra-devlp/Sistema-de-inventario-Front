import { HttpClient, HttpContext, HttpContextToken, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, of, retry, tap, throwError, timer } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthUser, LoginResponse, PLATFORM_ADMIN_ROLES, homePathForRole } from './auth.model';

/** Claves de la versión anterior, que guardaba el token en el navegador. Se borran al iniciar. */
const LEGACY_KEYS = ['inventario.token', 'inventario.user'];

/** Peticiones cuyo 401 no debe mandar al login con aviso de "sesión vencida". */
export const SKIP_SESSION_REDIRECT = new HttpContextToken<boolean>(() => false);

/**
 * La sesión vive en una cookie httpOnly que pone la API: el JavaScript no puede leer el token.
 * Aquí solo se guarda en memoria el usuario actual, que se pide a `/users/me` al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly current = signal<AuthUser | null>(null);

  readonly user = this.current.asReadonly();

  /** Recupera la sesión desde la cookie. La llama el inicializador de la app antes de enrutar. */
  restore(): Promise<void> {
    for (const key of LEGACY_KEYS) {
      try {
        localStorage.removeItem(key);
      } catch {
        // Almacenamiento bloqueado: no hay nada que limpiar.
      }
    }

    const me$ = this.http
      .get<AuthUser>(`${API_URL}/users/me`, {
        context: new HttpContext().set(SKIP_SESSION_REDIRECT, true),
      })
      .pipe(
        // El servidor gratuito puede estar despertando: reintenta si el proxy agota el tiempo.
        retry({
          count: 2,
          delay: (error: unknown) =>
            error instanceof HttpErrorResponse && [502, 503, 504].includes(error.status)
              ? timer(3000)
              : throwError(() => error),
        }),
        catchError(() => of(null)),
      );

    return firstValueFrom(me$).then((user) => this.current.set(user));
  }

  isLoggedIn(): boolean {
    return this.current() !== null;
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
      .pipe(tap((response) => this.current.set(response.user)));
  }

  /** Cierra la sesión en la API (borra la cookie) y en la app. */
  logout(): void {
    this.clearSession();
    this.http
      .post(`${API_URL}/users/logout`, null, {
        context: new HttpContext().set(SKIP_SESSION_REDIRECT, true),
      })
      .subscribe({ error: () => undefined });
  }

  /** Olvida el usuario en la app sin llamar a la API (la sesión ya venció). */
  clearSession(): void {
    this.current.set(null);
  }

  /** Actualiza el usuario en sesión (por ejemplo tras editar la cuenta). */
  setUser(user: AuthUser): void {
    this.current.set(user);
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

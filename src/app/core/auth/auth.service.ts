import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthUser, LoginResponse } from './auth.model';

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

  isAdmin(): boolean {
    return this.current()?.role === 'Administrador';
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
    if (error.status === 0) return `${fallback}. No hay conexión con la API; revisa que el backend esté encendido`;
    const detail = error.error?.detail;
    if (typeof detail === 'string' && detail.trim()) return detail;
    // FastAPI devuelve los errores de validación (422) como una lista de { loc, msg }.
    if (Array.isArray(detail) && detail.length) {
      const fields = detail
        .map((item) => (Array.isArray(item?.loc) ? item.loc[item.loc.length - 1] : null))
        .filter((field): field is string => typeof field === 'string');
      if (fields.length) return `${fallback}. Revisa: ${[...new Set(fields)].join(', ')}`;
    }
    if (error.status >= 500) return `${fallback}. Error del servidor (${error.status})`;
  }
  return fallback;
}

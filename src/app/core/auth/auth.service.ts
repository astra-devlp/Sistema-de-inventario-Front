import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, retry, switchMap, tap, throwError, timer } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { SKIP_SESSION_REDIRECT } from '@core/api/http-context';
import { CompanyService } from '@core/company/company.service';
import { AuthUser, LoginResponse, PLATFORM_ADMIN_ROLES, homePathForRole } from './auth.model';
import { clearToken, purgeLegacyStorage, readToken, saveToken } from './token-storage';

export { httpErrorMessage } from '@core/api/api-error';

/** Ruta de la pantalla de renovación del plan. */
export const PLAN_EXPIRED_PATH = '/plan-vencido';

/**
 * La API entrega un JWT en el login y lo espera en `Authorization: Bearer` (lo agrega el interceptor).
 * El token vive en sessionStorage (ver `token-storage.ts`); aquí queda en memoria el usuario actual,
 * que se pide a `/users/me` al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly company = inject(CompanyService);
  private readonly current = signal<AuthUser | null>(null);
  private readonly planExpiredFlag = signal(false);

  readonly user = this.current.asReadonly();
  /** La empresa tiene el plan vencido: la sesión sigue válida, pero no se puede operar. */
  readonly planExpired = this.planExpiredFlag.asReadonly();

  /** Recupera la sesión desde el token guardado. La llama el inicializador de la app antes de enrutar. */
  restore(): Promise<void> {
    purgeLegacyStorage();
    if (!readToken()) return Promise.resolve();

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
        catchError((error: unknown) => {
          // Solo el 401 invalida el token; con la API caída se conserva para reintentar.
          if (error instanceof HttpErrorResponse && error.status === 401) clearToken();
          return of(null);
        }),
        tap((user) => this.current.set(user)),
        switchMap((user) => (user ? this.refreshPlan() : of(undefined))),
      );

    return firstValueFrom(me$);
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

  /** Inicio del panel: con el plan vencido, la pantalla de renovación; si no, según el rol. */
  homePath(): string {
    if (this.planExpiredFlag()) return PLAN_EXPIRED_PATH;
    return homePathForRole(this.current()?.role);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/users/login`, { email, password }).pipe(
      tap((response) => {
        saveToken(response.access_token);
        this.current.set(response.user);
      }),
      // El login funciona con el plan vencido: se pregunta aparte para mandar a la pantalla de renovación.
      switchMap((response) => this.refreshPlan().pipe(map(() => response))),
    );
  }

  /** Consulta el plan de la empresa (`/companies/me`) y actualiza `planExpired`. Los errores no tumban la sesión. */
  refreshPlan(): Observable<void> {
    const user = this.current();
    if (!user || user.company_id === null) {
      this.planExpiredFlag.set(false);
      return of(undefined);
    }
    return this.company.me(true).pipe(
      tap((company) => this.planExpiredFlag.set(company.plan_expired)),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  setPlanExpired(expired: boolean): void {
    this.planExpiredFlag.set(expired);
  }

  /** Cierra la sesión: la API no guarda estado de sesión, basta con olvidar el token. */
  logout(): void {
    this.clearSession();
  }

  /** Olvida el token y el usuario en la app (por ejemplo, porque la API respondió 401). */
  clearSession(): void {
    clearToken();
    this.current.set(null);
    this.planExpiredFlag.set(false);
  }

  /** Actualiza el usuario en sesión (por ejemplo tras editar la cuenta). */
  setUser(user: AuthUser): void {
    this.current.set(user);
  }
}

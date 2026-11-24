import { HttpClient, HttpContext, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, firstValueFrom, map, of, retry, switchMap, tap, throwError, timer } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { SKIP_SESSION_REDIRECT } from '@core/api/http-context';
import { Company } from '@core/company/company.model';
import { CompanyService } from '@core/company/company.service';
import { AuthUser, LoginResponse, PLATFORM_ROLE, UserRole, homePathForRole } from './auth.model';
import { purgeLegacyStorage } from './session-cookies';

export { httpErrorMessage } from '@core/api/api-error';

/** Ruta de la pantalla de renovación del plan. */
export const PLAN_EXPIRED_PATH = '/plan-vencido';

/**
 * La sesión va en la cookie HttpOnly que pone la API en el login (ver `session-cookies.ts`): el front nunca ve ni
 * guarda el token. Aquí queda en memoria el usuario actual, que se pide a `/users/me` al abrir la app.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly companyApi = inject(CompanyService);
  private readonly current = signal<AuthUser | null>(null);
  private readonly planExpiredFlag = signal(false);
  private readonly currentCompany = signal<Company | null>(null);

  readonly user = this.current.asReadonly();
  /** Empresa del usuario (`/companies/me`); `null` para plataforma o si aún no se cargó. */
  readonly company = this.currentCompany.asReadonly();
  /** La empresa tiene el plan vencido: la sesión sigue válida, pero no se puede operar. */
  readonly planExpired = this.planExpiredFlag.asReadonly();

  /** Recupera la sesión desde la cookie (si la hay). La llama el inicializador de la app antes de enrutar. */
  restore(): Promise<void> {
    purgeLegacyStorage();

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
        // Sin sesión (401) o con la API caída: se arranca sin usuario; la cookie, si sirve, sigue en el navegador.
        catchError(() => of(null)),
        tap((user) => this.current.set(user)),
        switchMap((user) => (user ? this.refreshPlan() : of(undefined))),
      );

    return firstValueFrom(me$);
  }

  isLoggedIn(): boolean {
    return this.current() !== null;
  }

  hasRole(...roles: UserRole[]): boolean {
    const role = this.current()?.role;
    return role != null && roles.includes(role);
  }

  /** Dueño del software: sin empresa, solo opera la plataforma. */
  isPlatformAdmin(): boolean {
    return this.hasRole(PLATFORM_ROLE);
  }

  /** Administrador de la empresa: gestiona usuarios, sedes y los datos de la empresa. */
  isCompanyAdmin(): boolean {
    return this.hasRole('Administrador');
  }

  canManageStaff(): boolean {
    return this.isCompanyAdmin();
  }

  /** Inicio del panel: con el plan vencido, la pantalla de renovación; si no, según el rol. */
  homePath(): string {
    if (this.planExpiredFlag()) return PLAN_EXPIRED_PATH;
    return homePathForRole(this.current()?.role);
  }

  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${API_URL}/users/login`, { email, password }).pipe(
      tap((response) => this.current.set(response.user)),
      // El login funciona con el plan vencido: se pregunta aparte para mandar a la pantalla de renovación.
      switchMap((response) => this.refreshPlan().pipe(map(() => response))),
    );
  }

  /** Cambia la propia contraseña (`POST /users/me/password`). Una actual equivocada es 403: no cierra la sesión. */
  changeOwnPassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/users/me/password`, {
      current_password: currentPassword,
      new_password: newPassword,
    });
  }

  /** Recuperación: pide el código. La API responde lo mismo exista o no el correo. */
  forgotPassword(email: string): Observable<{ detail: string }> {
    return this.http.post<{ detail: string }>(`${API_URL}/users/password/forgot`, { email });
  }

  verifyResetCode(email: string, code: string): Observable<{ valid: boolean }> {
    return this.http.post<{ valid: boolean }>(`${API_URL}/users/password/verify`, { email, code });
  }

  resetPassword(email: string, code: string, newPassword: string): Observable<void> {
    return this.http.post<void>(`${API_URL}/users/password/reset`, { email, code, new_password: newPassword });
  }

  /** Consulta el plan de la empresa (`/companies/me`) y actualiza `planExpired`. Los errores no tumban la sesión. */
  refreshPlan(): Observable<void> {
    const user = this.current();
    if (!user || user.company_id === null) {
      this.planExpiredFlag.set(false);
      this.currentCompany.set(null);
      return of(undefined);
    }
    return this.companyApi.me(true).pipe(
      tap((company) => {
        this.currentCompany.set(company);
        this.planExpiredFlag.set(company.plan_expired);
      }),
      map(() => undefined),
      catchError(() => of(undefined)),
    );
  }

  /** Actualiza la empresa en memoria (por ejemplo tras editarla en Mi cuenta). */
  setCompany(company: Company): void {
    this.currentCompany.set(company);
  }

  setPlanExpired(expired: boolean): void {
    this.planExpiredFlag.set(expired);
  }

  /** Cierra la sesión: la API borra las cookies (el JavaScript no puede) y la app olvida al usuario. */
  logout(): void {
    this.http
      .post(`${API_URL}/users/logout`, null, { context: new HttpContext().set(SKIP_SESSION_REDIRECT, true) })
      .subscribe({ error: () => undefined });
    this.clearSession();
  }

  /** Olvida el usuario en la app (por ejemplo, porque la API respondió 401). */
  clearSession(): void {
    this.current.set(null);
    this.currentCompany.set(null);
    this.planExpiredFlag.set(false);
  }

  /** Actualiza el usuario en sesión (por ejemplo tras editar la cuenta). */
  setUser(user: AuthUser): void {
    this.current.set(user);
  }
}

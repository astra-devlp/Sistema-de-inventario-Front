import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { isPlanExpired } from '@core/api/api-error';
import { API_URL } from '@core/api/api-url';
import { SKIP_SESSION_REDIRECT } from '@core/api/http-context';
import { AuthService, PLAN_EXPIRED_PATH } from './auth.service';
import { CSRF_HEADER, readCsrfToken } from './session-cookies';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Manda la cookie de sesión HttpOnly a nuestra API (`withCredentials`, nunca a otras URL) y, en las escrituras,
 * repite el token CSRF en `X-CSRF-Token`. Decide además qué hacer con los errores:
 * - 401: sesión vencida o token inválido → se limpia y se vuelve al login. Es el único que cierra sesión.
 * - 403 con `detail.code === 'plan_vencido'`: la sesión sigue válida → pantalla de renovación del plan.
 * - cualquier otro 403 (rol insuficiente, autorización no válida): no toca la sesión; cada pantalla muestra el detalle.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith(`${API_URL}/`)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const isLogin = req.url === `${API_URL}/users/login`;
  const csrf = !isLogin && UNSAFE_METHODS.has(req.method) ? readCsrfToken() : null;
  const apiReq = req.clone({ withCredentials: true, ...(csrf ? { setHeaders: { [CSRF_HEADER]: csrf } } : {}) });

  return next(apiReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse) {
        if (error.status === 401 && !isLogin && !req.context.get(SKIP_SESSION_REDIRECT)) {
          auth.clearSession();
          void router.navigate(['/login'], { queryParams: { expired: 1 } });
        } else if (isPlanExpired(error)) {
          auth.setPlanExpired(true);
          if (!router.url.startsWith(PLAN_EXPIRED_PATH)) void router.navigateByUrl(PLAN_EXPIRED_PATH);
        }
      }
      return throwError(() => error);
    }),
  );
};

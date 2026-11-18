import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthService, SKIP_SESSION_REDIRECT } from './auth.service';

/**
 * La cookie de sesión la envía el navegador solo a nuestra API (mismo sitio, vía proxy).
 * La cabecera anti-CSRF la agrega Angular (withXsrfConfiguration en app.config).
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = req.url.startsWith(API_URL);
  const isLogin = req.url.includes('/users/login');
  const apiReq = isApi ? req.clone({ withCredentials: true }) : req;

  return next(apiReq).pipe(
    catchError((error: unknown) => {
      const redirect = isApi && !isLogin && !req.context.get(SKIP_SESSION_REDIRECT);
      if (redirect && error instanceof HttpErrorResponse && error.status === 401) {
        // Sesión vencida o cookie inválida: se limpia y se vuelve al login.
        auth.clearSession();
        void router.navigate(['/login'], { queryParams: { expired: 1 } });
      }
      // 403 no cierra la sesión: el usuario sigue autenticado pero sin permiso; cada pantalla muestra el detalle.
      return throwError(() => error);
    }),
  );
};

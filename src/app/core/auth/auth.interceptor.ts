import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isApi = req.url.startsWith(API_URL);
  const isLogin = req.url.includes('/users/login');
  const token = auth.token();
  // El token solo viaja hacia nuestra API, nunca a terceros.
  const authReq = token && isApi && !isLogin ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authReq).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && isApi && !isLogin && error.status === 401) {
        // Sesión vencida o token inválido: se limpia y se vuelve al login.
        auth.logout();
        void router.navigate(['/login'], { queryParams: { expired: 1 } });
      }
      // 403 no cierra la sesión: el usuario sigue autenticado pero sin permiso; cada pantalla muestra el detalle.
      return throwError(() => error);
    }),
  );
};

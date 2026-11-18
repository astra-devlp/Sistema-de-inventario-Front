import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { UserRole } from './auth.model';
import { AuthService, PLAN_EXPIRED_PATH } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  // Con el plan vencido no se opera ningún módulo: solo la pantalla de renovación.
  if (auth.planExpired()) return router.createUrlTree([PLAN_EXPIRED_PATH]);
  return true;
};

/** Pantalla de renovación: solo con sesión y con el plan vencido. */
export const planExpiredGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
  if (auth.planExpired()) return true;
  return router.createUrlTree([auth.homePath()]);
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (!auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree([auth.homePath()]);
};

/**
 * Solo los roles indicados entran; el resto vuelve a su inicio. El menú oculta lo mismo, pero la ruta
 * también se protege porque se puede escribir la URL a mano. La API sigue siendo la que manda (403).
 */
export function roleGuard(...roles: UserRole[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isLoggedIn()) return router.createUrlTree(['/login']);
    if (auth.hasRole(...roles)) return true;
    return router.createUrlTree([auth.homePath()]);
  };
}

/** Entrada del panel según rol. */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return inject(Router).createUrlTree([auth.homePath()]);
};

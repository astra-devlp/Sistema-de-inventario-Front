import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
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

/** Solo administradores de la plataforma. */
export const adminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn() && auth.isAdmin()) return true;
  return inject(Router).createUrlTree([auth.homePath()]);
};

/** Cliente o Admin: módulo Usuarios (personal). El rol Usuario no entra. */
export const clientGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn() && (auth.isClient() || auth.isAdmin())) return true;
  return inject(Router).createUrlTree([auth.homePath()]);
};

/** Entrada del panel según rol (Usuario → caja, resto → asesoría). */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  return inject(Router).createUrlTree([auth.homePath()]);
};

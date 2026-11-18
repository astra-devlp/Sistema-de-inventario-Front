import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isLoggedIn()) return true;
  return inject(Router).createUrlTree(['/login']);
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

import { Routes } from '@angular/router';
import { adminGuard } from '@core/auth/auth.guard';

export const ADMIN_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'cuentas' },
  {
    path: 'cuentas',
    canActivate: [adminGuard],
    loadComponent: () => import('./pages/accounts/accounts-page').then((m) => m.AccountsPage),
  },
];

import { Routes } from '@angular/router';

export const CUSTOMERS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listado' },
  {
    path: 'listado',
    loadComponent: () => import('./pages/customers/customers-page').then((m) => m.CustomersPage),
  },
];

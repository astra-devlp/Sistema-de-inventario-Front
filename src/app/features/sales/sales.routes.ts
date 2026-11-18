import { Routes } from '@angular/router';

export const SALES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/sale/sale-page').then((m) => m.SalePage),
  },
];

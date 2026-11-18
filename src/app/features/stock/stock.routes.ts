import { Routes } from '@angular/router';

export const STOCK_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/stock/stock-page').then((m) => m.StockPage),
  },
];

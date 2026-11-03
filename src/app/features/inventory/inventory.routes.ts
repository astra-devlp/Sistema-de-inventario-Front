import { Routes } from '@angular/router';

export const INVENTORY_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'existencias' },
  {
    path: 'existencias',
    loadComponent: () => import('./pages/stock/stock-page').then((m) => m.StockPage),
  },
  {
    path: 'movimientos',
    loadComponent: () => import('./pages/movements/movements-page').then((m) => m.MovementsPage),
  },
  {
    path: 'bodegas',
    loadComponent: () => import('./pages/warehouses/warehouses-page').then((m) => m.WarehousesPage),
  },
];

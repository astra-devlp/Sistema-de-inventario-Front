import { Routes } from '@angular/router';

export const PRODUCTS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listado' },
  {
    path: 'listado',
    loadComponent: () => import('./pages/products/products-page').then((m) => m.ProductsPage),
  },
  {
    path: 'categorias',
    loadComponent: () => import('./pages/categories/categories-page').then((m) => m.CategoriesPage),
  },
  {
    path: 'codigos',
    loadComponent: () => import('./pages/barcodes/barcodes-page').then((m) => m.BarcodesPage),
  },
  {
    path: 'unidades',
    loadComponent: () => import('./pages/units/units-page').then((m) => m.UnitsPage),
  },
  {
    path: 'precios',
    loadComponent: () => import('./pages/pricing/pricing-page').then((m) => m.PricingPage),
  },
];

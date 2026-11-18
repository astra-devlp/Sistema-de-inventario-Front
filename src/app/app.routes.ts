import { Routes } from '@angular/router';
import {
  authGuard,
  guestGuard,
  homeRedirectGuard,
  planExpiredGuard,
  roleGuard,
} from './core/auth/auth.guard';
import { COMPANY_ROLES, PLATFORM_ROLE } from './core/auth/auth.model';
import { MainLayout } from './core/layout/main-layout/main-layout';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'plan-vencido',
    canActivate: [planExpiredGuard],
    loadComponent: () => import('./features/plan/plan-expired-page').then((m) => m.PlanExpiredPage),
  },
  {
    path: '',
    component: MainLayout,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },
      {
        path: 'plataforma',
        canActivate: [roleGuard(PLATFORM_ROLE)],
        loadComponent: () => import('./features/platform/platform-page').then((m) => m.PlatformPage),
      },
      {
        path: 'productos',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/products/products.routes').then((m) => m.PRODUCTS_ROUTES),
      },
      {
        path: 'stock',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/stock/stock.routes').then((m) => m.STOCK_ROUTES),
      },
      {
        path: 'venta',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/sales/sales.routes').then((m) => m.SALES_ROUTES),
      },
      {
        path: 'turno',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/cash-shift/shift.routes').then((m) => m.SHIFT_ROUTES),
      },
      {
        path: 'informes',
        canActivate: [roleGuard('Administrador', 'Supervisor')],
        loadChildren: () => import('./features/reports/reports.routes').then((m) => m.REPORTS_ROUTES),
      },
      {
        path: 'clientes',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/customers/customers.routes').then((m) => m.CUSTOMERS_ROUTES),
      },
      {
        path: 'sedes',
        canActivate: [roleGuard(...COMPANY_ROLES)],
        loadChildren: () => import('./features/locations/locations.routes').then((m) => m.LOCATIONS_ROUTES),
      },
      {
        path: 'usuarios',
        canActivate: [roleGuard('Administrador')],
        loadChildren: () => import('./features/users/users.routes').then((m) => m.USERS_ROUTES),
      },
      {
        path: 'cuenta',
        loadComponent: () => import('./features/account/account-page').then((m) => m.AccountPage),
      },
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./features/settings/settings-page').then((m) => m.SettingsPage),
      },
    ],
  },
  { path: '**', canActivate: [authGuard, homeRedirectGuard], children: [] },
];

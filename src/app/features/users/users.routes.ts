import { Routes } from '@angular/router';

export const USERS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'listado' },
  {
    path: 'listado',
    loadComponent: () => import('./pages/users/users-page').then((m) => m.UsersPage),
  },
];

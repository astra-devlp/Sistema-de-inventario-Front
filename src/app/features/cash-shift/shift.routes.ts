import { Routes } from '@angular/router';

export const SHIFT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/shift/shift-page').then((m) => m.ShiftPage),
  },
];

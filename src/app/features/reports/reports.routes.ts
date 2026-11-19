import { Routes } from '@angular/router';

export const REPORTS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/daily/daily-page').then((m) => m.DailyPage),
  },
];

import { Routes } from '@angular/router';

export const LOCATIONS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./pages/locations/locations-page').then((m) => m.LocationsPage),
  },
];

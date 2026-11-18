import type { NavGroup } from '@core/navigation/nav.model';

/** Todos los roles de empresa la ven; solo el Administrador escribe (la API decide). */
export const LOCATIONS_NAV: NavGroup = {
  id: 'locations',
  label: 'Sedes y cajas',
  icon: 'warehouse',
  path: '/sedes',
  items: [],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

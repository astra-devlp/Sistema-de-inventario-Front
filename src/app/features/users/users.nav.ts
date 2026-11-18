import type { NavGroup } from '@core/navigation/nav.model';

/** Solo el Administrador de la empresa crea usuarios y cambia roles. */
export const USERS_NAV: NavGroup = {
  id: 'users',
  label: 'Usuarios',
  icon: 'users',
  path: '/usuarios/listado',
  items: [],
  roles: ['Administrador'],
};

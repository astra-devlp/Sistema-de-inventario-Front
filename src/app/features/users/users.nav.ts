import type { NavGroup } from '@core/navigation/nav.model';

export const USERS_NAV: NavGroup = {
  id: 'users',
  label: 'Usuarios',
  icon: 'users',
  items: [{ label: 'Usuarios', icon: 'users', path: '/usuarios/listado' }],
};

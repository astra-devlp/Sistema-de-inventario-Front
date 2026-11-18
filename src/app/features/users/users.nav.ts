import type { NavGroup } from '@core/navigation/nav.model';

/** Personal del negocio: solo el Cliente (dueño) gestiona a sus Usuario. */
export const USERS_NAV: NavGroup = {
  id: 'users',
  label: 'Usuarios',
  icon: 'users',
  items: [{ label: 'Usuarios', icon: 'users', path: '/usuarios/listado' }],
  roles: ['Cliente'],
};

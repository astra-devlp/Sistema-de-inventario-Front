import type { NavGroup } from '@core/navigation/nav.model';

/** Solo Administrador: ve cuentas (Administrador/Cliente) de forma general. */
export const ADMIN_NAV: NavGroup = {
  id: 'admin',
  label: 'Administración',
  icon: 'shield',
  items: [{ label: 'Cuentas', icon: 'users', path: '/admin/cuentas' }],
  roles: ['Administrador'],
};

import type { NavGroup } from '@core/navigation/nav.model';

/**
 * Admin / Cliente: módulo general «Usuarios» con Clientes + personal.
 * Rol Usuario: solo «Clientes» como enlace directo (sin submenú).
 */
export const CUSTOMERS_NAV_MANAGERS: NavGroup = {
  id: 'people',
  label: 'Usuarios',
  icon: 'users',
  items: [
    { label: 'Clientes', icon: 'id-card', path: '/clientes/listado' },
    { label: 'Usuarios', icon: 'users', path: '/usuarios/listado' },
  ],
  roles: ['Administrador', 'Administrador de plataforma', 'Cliente'],
};

export const CUSTOMERS_NAV_STAFF: NavGroup = {
  id: 'customers',
  label: 'Clientes',
  icon: 'id-card',
  path: '/clientes/listado',
  items: [],
  roles: ['Usuario'],
};

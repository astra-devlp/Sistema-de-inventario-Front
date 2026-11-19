import type { NavGroup } from '@core/navigation/nav.model';

/** Clientes finales de la empresa (quienes compran en la caja): los ven todos los roles de empresa. */
export const CUSTOMERS_NAV: NavGroup = {
  id: 'customers',
  label: 'Clientes',
  icon: 'id-card',
  path: '/clientes/listado',
  items: [],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

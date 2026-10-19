import type { NavGroup } from '@core/navigation/nav.model';

export const CUSTOMERS_NAV: NavGroup = {
  id: 'customers',
  label: 'Clientes',
  icon: 'id-card',
  items: [{ label: 'Clientes', icon: 'id-card', path: '/clientes/listado' }],
};

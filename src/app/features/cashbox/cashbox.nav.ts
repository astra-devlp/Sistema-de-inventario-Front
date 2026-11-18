import type { NavGroup } from '@core/navigation/nav.model';

/** Panel operativo de caja: visible para todos los roles autenticados. */
export const CASHBOX_NAV: NavGroup = {
  id: 'cashbox',
  label: 'Cierre de caja',
  icon: 'dollar',
  path: '/cierre-caja',
  items: [],
  roles: ['Administrador', 'Administrador de plataforma', 'Cliente', 'Usuario'],
};

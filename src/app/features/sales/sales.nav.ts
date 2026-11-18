import type { NavGroup } from '@core/navigation/nav.model';

/** La caja es el inicio del Cajero; Supervisor y Administrador también venden. */
export const SALES_NAV: NavGroup = {
  id: 'sales',
  label: 'Venta',
  icon: 'cart',
  path: '/venta',
  items: [],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

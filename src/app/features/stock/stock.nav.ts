import type { NavGroup } from '@core/navigation/nav.model';

/** Todos los roles de empresa la ven; entradas para todos, mermas, ajustes e inventario inicial solo Administrador. */
export const STOCK_NAV: NavGroup = {
  id: 'stock',
  label: 'Stock',
  icon: 'package',
  path: '/stock',
  items: [],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

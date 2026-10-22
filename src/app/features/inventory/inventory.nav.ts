import type { NavGroup } from '@core/navigation/nav.model';

export const INVENTORY_NAV: NavGroup = {
  id: 'inventory',
  label: 'Inventario',
  icon: 'warehouse',
  items: [
    { label: 'Existencias', icon: 'package', path: '/inventario/existencias' },
    { label: 'Movimientos', icon: 'arrows', path: '/inventario/movimientos' },
    { label: 'Bodegas', icon: 'warehouse', path: '/inventario/bodegas' },
  ],
};

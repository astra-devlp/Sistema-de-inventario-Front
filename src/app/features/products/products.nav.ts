import type { NavGroup } from '@core/navigation/nav.model';

/** Menú del módulo de productos: el core solo lo consume, no lo conoce. */
export const PRODUCTS_NAV: NavGroup = {
  id: 'products',
  label: 'Productos',
  icon: 'box',
  items: [
    { label: 'Productos', icon: 'box', path: '/productos/listado' },
    { label: 'Categorías', icon: 'tag', path: '/productos/categorias' },
    { label: 'Códigos y SKU', icon: 'barcode', path: '/productos/codigos' },
    { label: 'Unidades y presentaciones', icon: 'layers', path: '/productos/unidades' },
    { label: 'Precios e IVA', icon: 'dollar', path: '/productos/precios' },
  ],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

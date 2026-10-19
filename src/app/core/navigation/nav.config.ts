import { CUSTOMERS_NAV } from '@features/customers/customers.nav';
import { PRODUCTS_NAV } from '@features/products/products.nav';
import { USERS_NAV } from '@features/users/users.nav';
import type { NavGroup } from './nav.model';

/** Para sumar un módulo nuevo basta con agregar su grupo aquí y su ruta en app.routes.ts. */
export const NAV_GROUPS: NavGroup[] = [PRODUCTS_NAV, CUSTOMERS_NAV, USERS_NAV];

/** Módulos futuros: se muestran deshabilitados como referencia. */
export const UPCOMING_NAV: Pick<NavGroup, 'label' | 'icon'>[] = [
  { label: 'Inventario', icon: 'home' },
  { label: 'Compras', icon: 'truck' },
  { label: 'Ventas', icon: 'cart' },
];

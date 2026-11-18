import { ADMIN_NAV } from '@features/admin/admin.nav';
import { CASHBOX_NAV } from '@features/cashbox/cashbox.nav';
import {
  CUSTOMERS_NAV_MANAGERS,
  CUSTOMERS_NAV_STAFF,
} from '@features/customers/customers.nav';
import { DASHBOARD_NAV } from '@features/dashboard/dashboard.nav';
import { INVENTORY_NAV } from '@features/inventory/inventory.nav';
import { PRODUCTS_NAV } from '@features/products/products.nav';
import type { NavGroup } from './nav.model';

/** Para sumar un módulo nuevo basta con agregar su grupo aquí y su ruta en app.routes.ts. */
export const NAV_GROUPS: NavGroup[] = [
  DASHBOARD_NAV,
  CASHBOX_NAV,
  PRODUCTS_NAV,
  INVENTORY_NAV,
  CUSTOMERS_NAV_MANAGERS,
  CUSTOMERS_NAV_STAFF,
  ADMIN_NAV,
];

/** Módulos futuros: se muestran deshabilitados como referencia. */
export const UPCOMING_NAV: Pick<NavGroup, 'label' | 'icon'>[] = [
  { label: 'Compras', icon: 'truck' },
  { label: 'Ventas', icon: 'cart' },
];

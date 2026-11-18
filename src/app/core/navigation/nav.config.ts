import { CUSTOMERS_NAV } from '@features/customers/customers.nav';
import { LOCATIONS_NAV } from '@features/locations/locations.nav';
import { PLATFORM_NAV } from '@features/platform/platform.nav';
import { PRODUCTS_NAV } from '@features/products/products.nav';
import { STOCK_NAV } from '@features/stock/stock.nav';
import { USERS_NAV } from '@features/users/users.nav';
import type { UserRole } from '@core/auth/auth.model';
import type { NavGroup } from './nav.model';

/** Para sumar un módulo nuevo basta con agregar su grupo aquí y su ruta en app.routes.ts. */
export const NAV_GROUPS: NavGroup[] = [PLATFORM_NAV, PRODUCTS_NAV, STOCK_NAV, CUSTOMERS_NAV, LOCATIONS_NAV, USERS_NAV];

/** Módulos futuros: se muestran deshabilitados como referencia. */
export const UPCOMING_NAV: Pick<NavGroup, 'label' | 'icon'>[] = [
  { label: 'Compras', icon: 'truck' },
  { label: 'Ventas', icon: 'cart' },
];

/** Grupos del menú que ve un rol. Un grupo sin `roles` lo ven todos. */
export function navGroupsForRole(groups: NavGroup[], role: UserRole | null | undefined): NavGroup[] {
  return groups.filter((group) => !group.roles?.length || (role != null && group.roles.includes(role)));
}

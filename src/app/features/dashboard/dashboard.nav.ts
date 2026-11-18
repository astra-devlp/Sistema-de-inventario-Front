import type { NavGroup } from '@core/navigation/nav.model';

/** Asesoría contable: home de Admin/Cliente. El personal (Usuario) entra a Cierre de caja. */
export const DASHBOARD_NAV: NavGroup = {
  id: 'dashboard',
  label: 'Inicio',
  icon: 'home',
  path: '/inicio',
  items: [],
  roles: ['Administrador', 'Administrador de plataforma', 'Cliente'],
};

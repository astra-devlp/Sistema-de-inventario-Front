import type { NavGroup } from '@core/navigation/nav.model';

/** El cierre es a ciegas para el Cajero: no hay totales ni agregados para él, ni en el menú ni por URL. */
export const REPORTS_NAV: NavGroup = {
  id: 'reports',
  label: 'Informe diario',
  icon: 'layers',
  path: '/informes',
  items: [],
  roles: ['Administrador', 'Supervisor'],
};

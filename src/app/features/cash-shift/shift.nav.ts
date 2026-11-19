import type { NavGroup } from '@core/navigation/nav.model';

/** Todos los roles de empresa abren y cierran su turno; Supervisor y Administrador además ven y fuerzan los de sus sedes. */
export const SHIFT_NAV: NavGroup = {
  id: 'shift',
  label: 'Turno',
  icon: 'dollar',
  path: '/turno',
  items: [],
  roles: ['Administrador', 'Supervisor', 'Usuario'],
};

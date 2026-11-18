import type { NavGroup } from '@core/navigation/nav.model';

/** El administrador de plataforma no usa los endpoints de negocio: solo ve su pantalla. */
export const PLATFORM_NAV: NavGroup = {
  id: 'platform',
  label: 'Plataforma',
  icon: 'shield',
  path: '/plataforma',
  items: [],
  roles: ['Administrador de plataforma'],
};

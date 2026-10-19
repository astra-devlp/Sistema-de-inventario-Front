import type { IconName } from '@shared/ui/icon/icon';

export interface NavItem {
  label: string;
  icon: IconName;
  path: string;
}

/** Cada módulo de negocio declara su propio grupo de menú. */
export interface NavGroup {
  id: string;
  label: string;
  icon: IconName;
  items: NavItem[];
}

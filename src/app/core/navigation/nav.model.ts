import type { UserRole } from '@core/auth/auth.model';
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
  /** Si existe, el ítem es enlace directo (sin submenú), p. ej. Inicio. */
  path?: string;
  /** Si se define, el grupo solo aparece para esos roles. */
  roles?: UserRole[];
}

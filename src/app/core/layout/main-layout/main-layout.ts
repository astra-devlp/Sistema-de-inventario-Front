import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { NAV_GROUPS, UPCOMING_NAV } from '@core/navigation/nav.config';
import { Icon } from '@shared/ui/icon/icon';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  protected readonly groups = NAV_GROUPS;
  protected readonly upcoming = UPCOMING_NAV;

  /** Móvil: el menú es un cajón superpuesto. */
  protected readonly drawerOpen = signal(false);
  /** Escritorio: el menú se reduce a solo íconos. */
  protected readonly collapsed = signal(false);
  /** Grupos desplegados (acordeón). */
  protected readonly expanded = signal<Set<string>>(new Set(NAV_GROUPS.map((g) => g.id)));

  protected toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected toggleCollapsed(): void {
    this.collapsed.update((v) => !v);
  }

  protected isExpanded(id: string): boolean {
    return this.expanded().has(id);
  }

  protected toggleGroup(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { NAV_GROUPS, UPCOMING_NAV } from '@core/navigation/nav.config';
import { Icon } from '@shared/ui/icon/icon';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly groups = NAV_GROUPS;
  protected readonly upcoming = UPCOMING_NAV;
  protected readonly user = this.auth.user;
  protected readonly initial = computed(() => (this.user()?.name.trim().charAt(0) || 'U').toUpperCase());

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

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }

  protected toggleGroup(id: string): void {
    this.expanded.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }
}

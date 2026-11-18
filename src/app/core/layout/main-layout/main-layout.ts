import { Component, computed, HostListener, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { userContextLabel } from '@core/auth/auth.model';
import { AuthService } from '@core/auth/auth.service';
import { NAV_GROUPS, UPCOMING_NAV, navGroupsForRole } from '@core/navigation/nav.config';
import { ThemeService } from '@core/theme/theme.service';
import { Icon } from '@shared/ui/icon/icon';

@Component({
  selector: 'app-main-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  templateUrl: './main-layout.html',
})
export class MainLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  protected readonly theme = inject(ThemeService);

  protected readonly upcoming = UPCOMING_NAV;
  protected readonly user = this.auth.user;
  protected readonly initial = computed(() => (this.user()?.name.trim().charAt(0) || 'U').toUpperCase());
  /** «Empresa · Rol» (plataforma: solo el rol). */
  protected readonly contextLabel = computed(() => userContextLabel(this.user(), this.auth.company()));
  /** Grupos del menú que corresponden al rol (la API sigue siendo la que decide). */
  protected readonly groups = computed(() => navGroupsForRole(NAV_GROUPS, this.user()?.role));

  protected homePath(): string {
    return this.auth.homePath();
  }

  /** Móvil: el menú es un cajón superpuesto. */
  protected readonly drawerOpen = signal(false);
  /** Escritorio: el menú se reduce a solo íconos. */
  protected readonly collapsed = signal(false);
  /** Grupos desplegados (acordeón). Arrancan cerrados. */
  protected readonly expanded = signal<Set<string>>(new Set());
  /** Menú del usuario en la barra superior. */
  protected readonly userMenuOpen = signal(false);

  @HostListener('document:click')
  protected onDocumentClick(): void {
    if (this.userMenuOpen()) this.userMenuOpen.set(false);
  }

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

  protected toggleUserMenu(event: Event): void {
    event.stopPropagation();
    this.userMenuOpen.update((open) => !open);
  }

  protected keepUserMenu(event: Event): void {
    event.stopPropagation();
  }

  protected goTo(path: string): void {
    this.userMenuOpen.set(false);
    void this.router.navigateByUrl(path);
  }

  protected logout(): void {
    this.userMenuOpen.set(false);
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

import { Component, inject, signal } from '@angular/core';
import { AuthUser, roleLabel } from '@core/auth/auth.model';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { deleteConflictMessage, isConflict } from '@core/api/api-error';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SecureDeleteModal } from '@shared/ui/secure-delete-modal/secure-delete-modal';
import { UsersApi } from '../../users.api';
import { UserFormModal } from './modals/user-form-modal';
import { UserLocationsModal } from './modals/user-locations-modal';

type UserModal = 'create' | 'edit' | 'delete' | 'locations' | null;

@Component({
  selector: 'app-users-page',
  imports: [PageHeader, Icon, UserFormModal, UserLocationsModal, SecureDeleteModal],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  protected readonly auth = inject(AuthService);

  protected readonly roleLabel = roleLabel;
  protected readonly users = signal<AuthUser[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UserModal>(null);
  protected readonly selected = signal<AuthUser | null>(null);
  /** Usuario que no se pudo borrar por tener historial: se propone desactivarlo. */
  protected readonly offer = signal<AuthUser | null>(null);

  constructor() {
    this.load();
  }

  protected open(modal: UserModal, user: AuthUser | null = null): void {
    this.selected.set(user);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.load();
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const user = this.selected();
    if (!user) return;
    this.api.delete(user.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(deleteConflictMessage(err, 'No se pudo eliminar el usuario'));
        this.offer.set(isConflict(err) && user.is_active ? user : null);
      },
    });
  }

  protected deactivate(): void {
    const user = this.offer();
    if (!user) return;
    this.api.update(user.id, { is_active: false }).subscribe({
      next: () => this.load(),
      error: (err: unknown) => {
        this.offer.set(null);
        this.error.set(httpErrorMessage(err, 'No se pudo desactivar el usuario'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.offer.set(null);
    this.api.list(this.query()).subscribe({
      next: (users) => {
        this.users.set(users);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los usuarios'));
      },
    });
  }
}

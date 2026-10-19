import { Component, inject, signal } from '@angular/core';
import { AuthUser } from '@core/auth/auth.model';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { UsersApi } from '../../users.api';
import { UserFormModal } from './modals/user-form-modal';

type UserModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-users-page',
  imports: [PageHeader, Icon, UserFormModal, ConfirmModal],
  templateUrl: './users-page.html',
})
export class UsersPage {
  private readonly api = inject(UsersApi);
  protected readonly auth = inject(AuthService);

  protected readonly users = signal<AuthUser[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UserModal>(null);
  protected readonly selected = signal<AuthUser | null>(null);

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
    const value = (event.target as HTMLInputElement).value;
    this.search(value);
  }

  protected search(value: string): void {
    this.query.set(value);
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
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar el usuario'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
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

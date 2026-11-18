import { Component, inject, signal } from '@angular/core';
import { ACCOUNT_ROLES, AuthUser } from '@core/auth/auth.model';
import { httpErrorMessage } from '@core/auth/auth.service';
import { UsersApi } from '@features/users/users.api';
import { UserFormModal } from '@features/users/pages/users/modals/user-form-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { SecureDeleteModal } from '@shared/ui/secure-delete-modal/secure-delete-modal';

type AccountModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-accounts-page',
  imports: [PageHeader, Icon, UserFormModal, SecureDeleteModal],
  templateUrl: './accounts-page.html',
})
export class AccountsPage {
  private readonly api = inject(UsersApi);

  protected readonly accounts = signal<AuthUser[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<AccountModal>(null);
  protected readonly selected = signal<AuthUser | null>(null);

  constructor() {
    this.load();
  }

  protected open(modal: AccountModal, user: AuthUser | null = null): void {
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

  protected formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('es-CO');
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
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar la cuenta'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.query()).subscribe({
      next: (users) => {
        this.accounts.set(users.filter((user) => ACCOUNT_ROLES.includes(user.role)));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las cuentas'));
      },
    });
  }
}

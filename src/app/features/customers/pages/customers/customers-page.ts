import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CustomersApi } from '../../customers.api';
import { Customer, DOCUMENT_TYPES, DocumentTypeOption, formatDocument, groupDocumentTypes } from '../../customers.model';
import { CustomerFormModal } from './modals/customer-form-modal';

type CustomerModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-customers-page',
  imports: [PageHeader, Icon, CustomerFormModal, ConfirmModal],
  templateUrl: './customers-page.html',
})
export class CustomersPage {
  private readonly api = inject(CustomersApi);

  protected readonly customers = signal<Customer[]>([]);
  protected readonly documentTypes = signal<DocumentTypeOption[]>(DOCUMENT_TYPES);
  protected readonly documentTypeGroups = computed(() => groupDocumentTypes(this.documentTypes()));
  protected readonly query = signal('');
  protected readonly documentType = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<CustomerModal>(null);
  protected readonly selected = signal<Customer | null>(null);
  protected readonly formatDocument = formatDocument;

  constructor() {
    this.api.documentTypes().subscribe({
      next: (types) => {
        if (types.length) this.documentTypes.set(types);
      },
    });
    this.load();
  }

  protected open(modal: CustomerModal, customer: Customer | null = null): void {
    this.selected.set(customer);
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

  protected onType(event: Event): void {
    this.documentType.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const customer = this.selected();
    if (!customer) return;
    this.api.delete(customer.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar el cliente'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.query(), this.documentType()).subscribe({
      next: (customers) => {
        this.customers.set(customers);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los clientes'));
      },
    });
  }
}

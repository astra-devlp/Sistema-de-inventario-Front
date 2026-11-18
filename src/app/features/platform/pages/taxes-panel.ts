import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Tax } from '@features/products/catalog.model';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { platformErrorMessage } from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { TaxFormModal } from './tax-form-modal';

type TaxesModal = 'form' | 'delete' | null;

/** Tarifas de IVA globales. Los 409 (tarifa en uso, copiada en ventas o predeterminada) se muestran tal cual. */
@Component({
  selector: 'app-taxes-panel',
  imports: [Icon, TaxFormModal, ConfirmModal],
  templateUrl: './taxes-panel.html',
})
export class TaxesPanel {
  private readonly api = inject(PlatformApi);

  protected readonly taxes = signal<Tax[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<TaxesModal>(null);
  protected readonly selected = signal<Tax | null>(null);

  constructor() {
    this.load();
  }

  protected rate(tax: Tax): string {
    return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
  }

  protected edit(tax: Tax | null): void {
    this.selected.set(tax);
    this.modal.set('form');
  }

  protected askDelete(tax: Tax): void {
    this.selected.set(tax);
    this.modal.set('delete');
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const tax = this.selected();
    if (!tax) return;
    this.api.deleteTax(tax.id).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => {
        this.close();
        this.error.set(platformErrorMessage(err, 'No se pudo eliminar la tarifa de IVA'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.taxes().subscribe({
      next: (taxes) => {
        this.taxes.set(taxes);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las tarifas de IVA'));
      },
    });
  }
}

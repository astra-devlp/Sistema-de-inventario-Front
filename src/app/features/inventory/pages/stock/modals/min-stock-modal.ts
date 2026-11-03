import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { InventoryApi } from '../../../inventory.api';
import { Stock, formatQuantity, toNumber } from '../../../inventory.model';

@Component({
  selector: 'app-min-stock-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './min-stock-modal.html',
})
export class MinStockModal {
  private readonly api = inject(InventoryApi);

  readonly open = input(false);
  readonly stock = input<Stock | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly formatQuantity = formatQuantity;
  protected readonly minimum = new FormControl<number | null>(0, { validators: [Validators.required, Validators.min(0)] });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.error.set(null);
      this.minimum.reset(toNumber(this.stock()?.min_stock));
    });
  }

  protected submit(): void {
    const stock = this.stock();
    if (!stock) return;
    if (this.minimum.invalid || this.minimum.value === null) {
      this.error.set('El stock mínimo debe ser cero o mayor');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .setMinimum({ product_id: stock.product_id, warehouse_id: stock.warehouse_id, min_stock: Number(this.minimum.value) })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(httpErrorMessage(err, 'No se pudo guardar el stock mínimo'));
        },
      });
  }
}

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Product, UnitRef } from '@features/products/products.model';
import { Modal } from '@shared/ui/modal/modal';
import { formatQuantity, parseQuantity } from '../../quantity';
import { StockApi } from '../../stock.api';

/** Mínimo de un producto en la sede (solo Administrador). Cero quita la alerta en esa sede. */
@Component({
  selector: 'app-minimum-modal',
  imports: [Modal, ReactiveFormsModule],
  template: `
    <app-modal [open]="product() !== null" title="Stock mínimo en la sede" (closed)="closed.emit()">
      <form class="form-grid" (submit)="$event.preventDefault(); submit()">
        @if (error()) {
          <p class="auth-error field--full">{{ error() }}</p>
        }
        <div class="field field--full">
          <span class="label">Producto</span>
          <p><strong>{{ product()?.name }}</strong> <span class="text-muted">· mínimo actual {{ formatQuantity(current()) }}</span></p>
        </div>
        <div class="field field--full">
          <label class="label" for="min-quantity">Mínimo <span class="required">*</span></label>
          <input id="min-quantity" class="input" type="text" inputmode="decimal" [formControl]="quantity" autocomplete="off" />
          <span class="hint">Cuando el saldo de esta sede llegue a este número o baje, aparece en las alertas. Cero quita la alerta.</span>
        </div>
      </form>
      <div modal-footer>
        <button type="button" class="btn btn--outline" (click)="closed.emit()">Cancelar</button>
        <button type="button" class="btn btn--primary" [disabled]="submitting()" (click)="submit()">
          {{ submitting() ? 'Guardando…' : 'Guardar' }}
        </button>
      </div>
    </app-modal>
  `,
})
export class MinimumModal {
  private readonly api = inject(StockApi);

  readonly product = input<Product | null>(null);
  readonly current = input<string>('0');
  readonly locationId = input<number | null>(null);
  readonly units = input<UnitRef[]>([]);
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly formatQuantity = formatQuantity;
  protected readonly quantity = new FormControl('', { nonNullable: true });
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  private readonly unit = computed(() => this.units().find((u) => u.id === this.product()?.unit_id));

  constructor() {
    effect(() => {
      if (!this.product()) return;
      this.error.set(null);
      this.submitting.set(false);
      this.quantity.setValue(formatQuantity(this.current()));
    });
  }

  protected submit(): void {
    const product = this.product();
    const locationId = this.locationId();
    if (!product || locationId === null) return;
    const parsed = parseQuantity(this.quantity.value, this.unit()?.unit_type, true);
    if (!parsed.ok) {
      this.error.set(parsed.error.replace('La cantidad', 'El mínimo'));
      return;
    }
    this.submitting.set(true);
    this.api.setMinimum(locationId, product.id, parsed.value).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit(`Mínimo de ${product.name} en esta sede: ${formatQuantity(parsed.value)}.`);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el mínimo'));
      },
    });
  }
}

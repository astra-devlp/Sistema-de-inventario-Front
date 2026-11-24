import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { formatCop } from '@core/money/money';
import { Location } from '@features/locations/location.model';
import { Product, UnitRef } from '@features/products/products.model';
import { formatQuantity } from '../../quantity';
import { StockApi } from '../../stock.api';
import { stockErrorMessage } from '../../stock-errors';
import { validateTransfer } from '../../stock-rules';
import { StockTransfer } from '../../stock.model';

/** Traslados de la sede elegida a otra sede activa (solo Administrador), con su historial. */
@Component({
  selector: 'app-transfer-panel',
  imports: [DatePipe, ReactiveFormsModule],
  templateUrl: './transfer-panel.html',
})
export class TransferPanel {
  private readonly api = inject(StockApi);

  readonly locationId = input.required<number>();
  readonly canWrite = input(false);
  readonly locations = input<Location[]>([]);
  readonly products = input<Product[]>([]);
  readonly units = input<UnitRef[]>([]);
  readonly levels = input<Map<number, string>>(new Map());
  readonly saved = output<string>();

  protected readonly formatQuantity = formatQuantity;
  protected readonly formatCop = formatCop;
  protected readonly errors = signal<string[]>([]);
  protected readonly submitting = signal(false);
  protected readonly history = signal<StockTransfer[]>([]);

  protected readonly form = new FormGroup({
    productId: new FormControl<number | null>(null),
    toLocationId: new FormControl<number | null>(null),
    quantity: new FormControl('', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  });

  /** Destinos posibles: las otras sedes activas. */
  protected readonly destinations = computed(() =>
    this.locations().filter((l) => l.is_active && l.id !== this.locationId()),
  );
  protected readonly activeProducts = computed(() => this.products().filter((p) => p.is_active));

  constructor() {
    effect(() => {
      this.locationId();
      this.form.reset({ productId: null, toLocationId: null, quantity: '', reason: '' });
      this.errors.set([]);
      this.load();
    });
  }

  protected locationName(id: number): string {
    return this.locations().find((l) => l.id === id)?.name ?? `Sede ${id}`;
  }

  protected productName(id: number): string {
    return this.products().find((p) => p.id === id)?.name ?? `Producto ${id}`;
  }

  protected available(): string {
    const productId = this.form.controls.productId.value;
    return productId === null ? '0' : (this.levels().get(Number(productId)) ?? '0');
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const productId = raw.productId === null ? null : Number(raw.productId);
    const product = this.products().find((p) => p.id === productId);
    if (!product) {
      this.errors.set(['Elige el producto']);
      return;
    }
    const unit = this.units().find((u) => u.id === product.unit_id);
    const toLocationId = raw.toLocationId === null ? null : Number(raw.toLocationId);
    const checked = validateTransfer({ fromLocationId: this.locationId(), toLocationId, quantity: raw.quantity, unitType: unit?.unit_type });
    if (!checked.ok) {
      this.errors.set([checked.error]);
      return;
    }
    this.submitting.set(true);
    this.errors.set([]);
    this.api
      .transfer({
        product_id: product.id,
        from_location_id: this.locationId(),
        to_location_id: toLocationId!,
        quantity: checked.value,
        reason: raw.reason.trim() || null,
      })
      .subscribe({
        next: (transfer) => {
          this.submitting.set(false);
          this.form.reset({ productId: null, toLocationId: null, quantity: '', reason: '' });
          this.load();
          this.saved.emit(
            `Trasladaste ${formatQuantity(transfer.quantity)} de ${product.name} a ${this.locationName(transfer.to_location_id)}.`,
          );
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.errors.set(stockErrorMessage(err, 'No se pudo registrar el traslado'));
        },
      });
  }

  private load(): void {
    this.api.transfers(this.locationId()).subscribe({
      next: (transfers) => this.history.set(transfers),
      error: (err: unknown) => this.errors.set(stockErrorMessage(err, 'No se pudo cargar el historial de traslados')),
    });
  }
}

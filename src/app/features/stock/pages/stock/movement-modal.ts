import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Product, UnitRef } from '@features/products/products.model';
import { Modal } from '@shared/ui/modal/modal';
import { formatQuantity, parseQuantity } from '../../quantity';
import { StockApi } from '../../stock.api';
import { stockErrorMessage } from '../../stock-errors';
import { StockMovement } from '../../stock.model';

export type MovementKind = 'entrada' | 'merma' | 'ajuste';

const TITLES: Record<MovementKind, string> = { entrada: 'Registrar entrada', merma: 'Registrar merma', ajuste: 'Ajustar con conteo' };
const MAX_REASON = 500;

/** Entrada (cualquier rol), merma y ajuste (Administrador). El ajuste envía lo contado: el back calcula la diferencia. */
@Component({
  selector: 'app-movement-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './movement-modal.html',
})
export class MovementModal {
  private readonly api = inject(StockApi);

  readonly state = input<{ kind: MovementKind; product: Product | null } | null>(null);
  readonly locationId = input<number | null>(null);
  readonly products = input<Product[]>([]);
  readonly units = input<UnitRef[]>([]);
  readonly levels = input<Map<number, string>>(new Map());
  readonly closed = output<void>();
  readonly saved = output<string>();

  protected readonly submitting = signal(false);
  protected readonly errors = signal<string[]>([]);
  protected readonly formatQuantity = formatQuantity;

  protected readonly kind = computed(() => this.state()?.kind ?? 'entrada');
  protected readonly product = computed(() => this.state()?.product ?? null);
  protected readonly title = computed(() => TITLES[this.kind()]);
  protected readonly unit = computed(() => this.units().find((u) => u.id === this.product()?.unit_id));
  protected readonly current = computed(() => this.levels().get(this.product()?.id ?? -1) ?? '0');
  protected readonly reasonRequired = computed(() => this.kind() !== 'entrada');

  protected readonly form = new FormGroup({
    quantity: new FormControl('', { nonNullable: true }),
    reason: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.state()) return;
      this.errors.set([]);
      this.submitting.set(false);
      this.form.reset({ quantity: '', reason: '' });
    });
  }

  protected submit(): void {
    const product = this.product();
    const locationId = this.locationId();
    if (!product || locationId === null) return;

    const raw = this.form.getRawValue();
    const quantity = parseQuantity(raw.quantity, this.unit()?.unit_type, this.kind() === 'ajuste');
    if (!quantity.ok) {
      this.errors.set([quantity.error]);
      return;
    }
    const reason = raw.reason.trim();
    if (this.reasonRequired() && !reason) {
      this.errors.set(['El motivo es obligatorio']);
      return;
    }
    if (reason.length > MAX_REASON) {
      this.errors.set([`El motivo admite como máximo ${MAX_REASON} caracteres`]);
      return;
    }

    const base = { location_id: locationId, product_id: product.id };
    const request =
      this.kind() === 'entrada'
        ? this.api.entry({ ...base, quantity: quantity.value, reason: reason || null })
        : this.kind() === 'merma'
          ? this.api.loss({ ...base, quantity: quantity.value, reason })
          : this.api.adjustment({ ...base, counted_quantity: quantity.value, reason });

    this.submitting.set(true);
    this.errors.set([]);
    request.subscribe({
      next: (movement) => {
        this.submitting.set(false);
        this.saved.emit(this.successMessage(product, movement));
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.errors.set(stockErrorMessage(err, 'No se pudo registrar el movimiento'));
      },
    });
  }

  private successMessage(product: Product, movement: StockMovement): string {
    const amount = formatQuantity(movement.quantity);
    const signed = movement.quantity.startsWith('-') ? amount : `+${amount}`;
    const label = { entrada: 'Entrada registrada', merma: 'Merma registrada', ajuste: 'Ajuste registrado' }[this.kind()];
    return `${label} en ${product.name}: ${signed}.`;
  }
}

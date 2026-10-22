import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { InventoryApi } from '../../../inventory.api';
import {
  MOVEMENT_TYPES,
  MovementPayload,
  MovementPreset,
  MovementType,
  ProductOption,
  Stock,
  Warehouse,
  formatMoney,
  formatQuantity,
  toNumber,
} from '../../../inventory.model';

@Component({
  selector: 'app-movement-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './movement-form-modal.html',
})
export class MovementFormModal {
  private readonly api = inject(InventoryApi);

  readonly open = input(false);
  readonly preset = input<MovementPreset | null>(null);
  readonly products = input<ProductOption[]>([]);
  readonly warehouses = input<Warehouse[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly types = MOVEMENT_TYPES;
  protected readonly activeProducts = computed(() => this.products().filter((product) => product.is_active));
  protected readonly activeWarehouses = computed(() => this.warehouses().filter((warehouse) => warehouse.is_active));
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly type = signal<MovementType>('entrada');
  protected readonly typeHint = computed(() => MOVEMENT_TYPES.find((item) => item.code === this.type())?.hint ?? '');
  /** Existencia actual del producto en la bodega elegida; null si aún no tiene. */
  protected readonly current = signal<Stock | null>(null);
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatMoney = formatMoney;

  protected readonly form = new FormGroup({
    movement_type: new FormControl<MovementType>('entrada', { nonNullable: true }),
    product_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    warehouse_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    quantity: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    unit_cost: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    reference: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const preset = this.preset();
      this.error.set(null);
      this.current.set(null);
      this.type.set(preset?.movement_type ?? 'entrada');
      this.form.reset({
        movement_type: preset?.movement_type ?? 'entrada',
        product_id: preset?.product_id ?? null,
        warehouse_id: preset?.warehouse_id ?? this.activeWarehouses()[0]?.id ?? null,
        quantity: null,
        unit_cost: null,
        reference: '',
        note: '',
      });
      this.prefillCost();
      this.loadCurrent();
    });

    this.form.controls.movement_type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.type.set(type);
      this.prefillCost();
    });
    this.form.controls.product_id.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.prefillCost();
      this.loadCurrent();
    });
    this.form.controls.warehouse_id.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.loadCurrent());
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (!raw.product_id) return this.error.set('Selecciona el producto');
    if (!raw.warehouse_id) return this.error.set('Selecciona la bodega');
    if (raw.quantity === null || raw.quantity === undefined || this.form.controls.quantity.invalid) {
      return this.error.set(this.type() === 'ajuste' ? 'Escribe la cantidad contada' : 'Escribe la cantidad');
    }
    if (this.type() !== 'ajuste' && raw.quantity <= 0) return this.error.set('La cantidad debe ser mayor que cero');
    if (this.form.controls.unit_cost.invalid) return this.error.set('El costo unitario no puede ser negativo');
    if (this.type() === 'entrada' && (raw.unit_cost === null || raw.unit_cost === undefined)) {
      return this.error.set('El costo unitario es obligatorio en una entrada');
    }
    const available = toNumber(this.current()?.quantity);
    if (this.type() === 'salida' && raw.quantity > available) {
      return this.error.set(`Existencia insuficiente. Disponible: ${formatQuantity(available)}`);
    }

    const payload: MovementPayload = {
      movement_type: raw.movement_type,
      product_id: Number(raw.product_id),
      warehouse_id: Number(raw.warehouse_id),
      quantity: Number(raw.quantity),
      unit_cost: this.type() === 'salida' || raw.unit_cost === null ? null : Number(raw.unit_cost),
      reference: raw.reference.trim() || null,
      note: raw.note.trim() || null,
    };

    this.submitting.set(true);
    this.error.set(null);
    this.api.registerMovement(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar el movimiento'));
      },
    });
  }

  /** En una entrada se propone el costo del producto; en un ajuste, el costo promedio vigente. */
  private prefillCost(): void {
    const control = this.form.controls.unit_cost;
    if (this.type() === 'salida') {
      control.setValue(null, { emitEvent: false });
      return;
    }
    if (this.type() === 'ajuste') {
      const average = this.current() ? toNumber(this.current()!.average_cost) : null;
      control.setValue(average, { emitEvent: false });
      return;
    }
    const product = this.products().find((item) => item.id === Number(this.form.controls.product_id.value));
    control.setValue(product?.cost != null ? toNumber(product.cost) : null, { emitEvent: false });
  }

  private loadCurrent(): void {
    const productId = Number(this.form.controls.product_id.value);
    const warehouseId = Number(this.form.controls.warehouse_id.value);
    this.current.set(null);
    if (!productId || !warehouseId) return;
    this.api.stock({ warehouseId }).subscribe({
      next: (stocks) => {
        this.current.set(stocks.find((stock) => stock.product_id === productId) ?? null);
        if (this.type() === 'ajuste') this.prefillCost();
      },
    });
  }
}

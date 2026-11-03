import { Component, ElementRef, computed, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
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
  TransferPayload,
  Warehouse,
  formatMoney,
  formatQuantity,
  toNumber,
} from '../../../inventory.model';

/** Diferencia (50%) frente al costo de referencia a partir de la cual se pide confirmar una entrada. */
const UNUSUAL_COST_CHANGE = 0.5;

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
  private readonly errorBox = viewChild<ElementRef<HTMLElement>>('errorBox');
  protected readonly type = signal<MovementType>('entrada');
  protected readonly typeHint = computed(() => MOVEMENT_TYPES.find((item) => item.code === this.type())?.hint ?? '');
  /** Bodega elegida (origen en un traslado); el destino no puede ser la misma. */
  protected readonly originId = signal<number | null>(null);
  protected readonly destinationWarehouses = computed(() =>
    this.activeWarehouses().filter((warehouse) => warehouse.id !== this.originId()),
  );
  /** Existencia actual del producto en la bodega elegida; null si aún no tiene. */
  protected readonly current = signal<Stock | null>(null);
  /** Costo escrito en una entrada y costo del producto elegido, para detectar un dígito de más o de menos. */
  private readonly costValue = signal<number | null>(null);
  private readonly productCost = signal<number | null>(null);
  /** El usuario ya vio el aviso de costo inusual y decidió guardar igual. */
  private costConfirmed = false;
  /** Costo de referencia: el promedio si ya hay existencia; si no, el costo del producto. */
  private readonly referenceCost = computed(() => {
    const stock = this.current();
    if (stock && toNumber(stock.quantity) > 0) return toNumber(stock.average_cost);
    return this.productCost();
  });
  protected readonly costWarning = computed(() => {
    const cost = this.costValue();
    const reference = this.referenceCost();
    if (this.type() !== 'entrada' || cost === null || !reference) return null;
    const change = (cost - reference) / reference;
    if (Math.abs(change) < UNUSUAL_COST_CHANGE) return null;
    const direction = change > 0 ? 'mayor' : 'menor';
    return `Este costo es ${Math.round(Math.abs(change) * 100)}% ${direction} que el de referencia (${formatMoney(reference)}). Revisa que no sobre o falte un dígito.`;
  });
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatMoney = formatMoney;

  protected readonly form = new FormGroup({
    movement_type: new FormControl<MovementType>('entrada', { nonNullable: true }),
    product_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    warehouse_id: new FormControl<number | null>(null, { validators: [Validators.required] }),
    to_warehouse_id: new FormControl<number | null>(null),
    quantity: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    unit_cost: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    reference: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    // Reinicia el formulario solo al abrirlo. Lo demás va en `untracked`: si el efecto leyera `type()`
    // u otra señal, cambiar el tipo en el desplegable volvería a ejecutarlo y regresaría todo a "Entrada".
    effect(() => {
      if (!this.open()) return;
      const preset = this.preset();
      untracked(() => {
        this.error.set(null);
        this.current.set(null);
        this.type.set(preset?.movement_type ?? 'entrada');
        const warehouseId = preset?.warehouse_id ?? this.activeWarehouses()[0]?.id ?? null;
        this.originId.set(warehouseId);
        this.form.reset({
          movement_type: preset?.movement_type ?? 'entrada',
          product_id: preset?.product_id ?? null,
          warehouse_id: warehouseId,
          to_warehouse_id: null,
          quantity: null,
          unit_cost: null,
          reference: '',
          note: '',
        });
        this.prefillCost();
        this.loadCurrent();
      });
    });

    // El error se muestra arriba del formulario; si el usuario bajó para llenar la cantidad, lo llevamos a la vista.
    effect(() => {
      if (this.error()) this.errorBox()?.nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });

    this.form.controls.unit_cost.valueChanges.pipe(takeUntilDestroyed()).subscribe((cost) => {
      this.costValue.set(cost === null || cost === undefined || `${cost}` === '' ? null : Number(cost));
      this.costConfirmed = false;
    });

    this.form.controls.movement_type.valueChanges.pipe(takeUntilDestroyed()).subscribe((type) => {
      this.type.set(type);
      this.prefillCost();
    });
    this.form.controls.product_id.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => {
      this.prefillCost();
      this.loadCurrent();
    });
    this.form.controls.warehouse_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((warehouseId) => {
      this.originId.set(warehouseId === null ? null : Number(warehouseId));
      if (Number(this.form.controls.to_warehouse_id.value) === Number(warehouseId)) {
        this.form.controls.to_warehouse_id.setValue(null);
      }
      this.loadCurrent();
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const transfer = this.type() === 'traslado';
    if (!raw.product_id) return this.error.set('Selecciona el producto');
    if (!raw.warehouse_id) return this.error.set(transfer ? 'Selecciona la bodega de origen' : 'Selecciona la bodega');
    if (transfer && !raw.to_warehouse_id) return this.error.set('Selecciona la bodega de destino');
    if (raw.quantity === null || raw.quantity === undefined || this.form.controls.quantity.invalid) {
      return this.error.set(this.type() === 'ajuste' ? 'Escribe la cantidad contada' : 'Escribe la cantidad');
    }
    if (this.type() !== 'ajuste' && raw.quantity <= 0) return this.error.set('La cantidad debe ser mayor que cero');
    if (this.form.controls.unit_cost.invalid) return this.error.set('El costo unitario no puede ser negativo');
    if (this.type() === 'entrada' && (raw.unit_cost === null || raw.unit_cost === undefined)) {
      return this.error.set('El costo unitario es obligatorio en una entrada');
    }
    const available = toNumber(this.current()?.quantity);
    if ((this.type() === 'salida' || transfer) && raw.quantity > available) {
      return this.error.set(`Existencia insuficiente. Disponible: ${formatQuantity(available)}`);
    }
    // Un costo muy distinto al de referencia suele ser un dígito mal escrito: se pide un segundo clic.
    if (this.costWarning() && !this.costConfirmed) {
      this.costConfirmed = true;
      return this.error.set(`${this.costWarning()} Si es correcto, vuelve a dar clic en Registrar movimiento.`);
    }

    if (transfer) {
      this.submitTransfer({
        product_id: Number(raw.product_id),
        from_warehouse_id: Number(raw.warehouse_id),
        to_warehouse_id: Number(raw.to_warehouse_id),
        quantity: Number(raw.quantity),
        reference: raw.reference.trim() || null,
        note: raw.note.trim() || null,
      });
      return;
    }

    const payload: MovementPayload = {
      movement_type: raw.movement_type,
      product_id: Number(raw.product_id),
      warehouse_id: Number(raw.warehouse_id),
      quantity: Number(raw.quantity),
      // Solo la entrada lleva costo; salidas y ajustes van al costo promedio (la API rechaza otro costo).
      unit_cost: this.type() === 'entrada' && raw.unit_cost !== null ? Number(raw.unit_cost) : null,
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

  private submitTransfer(payload: TransferPayload): void {
    this.submitting.set(true);
    this.error.set(null);
    this.api.registerTransfer(payload).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar el traslado'));
      },
    });
  }

  /** Solo la entrada pide costo, y se propone el costo del producto. */
  private prefillCost(): void {
    const product = this.products().find((item) => item.id === Number(this.form.controls.product_id.value));
    this.productCost.set(product?.cost != null ? toNumber(product.cost) : null);
    this.form.controls.unit_cost.setValue(this.type() === 'entrada' ? this.productCost() : null);
  }

  private loadCurrent(): void {
    const productId = Number(this.form.controls.product_id.value);
    const warehouseId = Number(this.form.controls.warehouse_id.value);
    this.current.set(null);
    if (!productId || !warehouseId) return;
    this.api.stock({ warehouseId }).subscribe({
      next: (stocks) => {
        this.current.set(stocks.find((stock) => stock.product_id === productId) ?? null);
      },
    });
  }
}

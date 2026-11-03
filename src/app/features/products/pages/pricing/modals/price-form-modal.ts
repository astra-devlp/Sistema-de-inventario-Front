import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { PRICE_LISTS, Presentation, Price, PriceList, PricePayload, ProductOption, Tax, taxLabel, withTax } from '../../../catalog.model';
import { formatMoney } from '../../../products.model';

/** Número del formulario o null si el campo está vacío. */
function numberOrNull(value: number | null | undefined): number | null {
  return value === null || value === undefined || `${value}` === '' ? null : Number(value);
}

@Component({
  selector: 'app-price-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './price-form-modal.html',
})
export class PriceFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly price = input<Price | null>(null);
  readonly products = input<ProductOption[]>([]);
  readonly presentations = input<Presentation[]>([]);
  readonly taxes = input<Tax[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly priceLists = PRICE_LISTS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly productOptions = computed(() =>
    this.products().filter((product) => product.is_active || product.id === this.price()?.product_id),
  );

  protected readonly form = new FormGroup({
    product_id: new FormControl('', { nonNullable: true }),
    price_list: new FormControl<PriceList>('Detal', { nonNullable: true }),
    presentation_id: new FormControl('', { nonNullable: true }),
    cost: new FormControl<number | null>(null),
    margin: new FormControl<number | null>(null),
    price_without_tax: new FormControl<number | null>(null),
  });

  private readonly productId = signal('');
  private readonly net = signal<number | null>(null);

  /** IVA del producto elegido; la API calcula y guarda el precio con IVA definitivo. */
  protected readonly productTax = computed(() => {
    const product = this.products().find((item) => String(item.id) === this.productId());
    return product?.tax_id != null ? this.taxes().find((tax) => tax.id === product.tax_id) : undefined;
  });
  protected readonly taxText = computed(() => taxLabel(this.productTax()));
  protected readonly grossPreview = computed(() => {
    const net = this.net();
    return net === null || Number.isNaN(net) ? '' : formatMoney(withTax(net, this.productTax()));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const price = this.price();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          product_id: price ? String(price.product_id) : '',
          price_list: price?.price_list ?? 'Detal',
          presentation_id: price?.presentation_id ? String(price.presentation_id) : '',
          cost: price?.cost != null ? Number(price.cost) : null,
          margin: price?.margin != null ? Number(price.margin) : null,
          price_without_tax: price ? Number(price.price_without_tax) : null,
        });
        this.productId.set(this.form.controls.product_id.value);
        this.net.set(numberOrNull(this.form.controls.price_without_tax.value));
      });
    });

    this.form.controls.product_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      this.productId.set(id);
      // Al elegir producto en un precio nuevo se propone su costo.
      if (!this.price() && this.form.controls.cost.value === null) {
        const product = this.products().find((item) => String(item.id) === id);
        if (product?.cost != null) this.form.controls.cost.setValue(Number(product.cost));
      }
    });
    this.form.controls.cost.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyMargin());
    this.form.controls.margin.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.applyMargin());
    this.form.controls.price_without_tax.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((value) => this.net.set(numberOrNull(value)));
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const net = numberOrNull(raw.price_without_tax);
    const cost = numberOrNull(raw.cost);
    const margin = numberOrNull(raw.margin);
    if (!raw.product_id) return this.error.set('Selecciona el producto');
    if (net === null || net < 0) return this.error.set('El precio sin IVA es obligatorio y no puede ser negativo');
    if ((cost !== null && cost < 0) || (margin !== null && margin < 0)) {
      return this.error.set('El costo y el margen no pueden ser negativos');
    }

    const payload: PricePayload = {
      product_id: Number(raw.product_id),
      price_list: raw.price_list,
      presentation_id: raw.presentation_id ? Number(raw.presentation_id) : null,
      cost,
      margin,
      price_without_tax: net,
    };
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.price();
    const request = editing ? this.api.updatePrice(editing.id, payload) : this.api.createPrice(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el precio'));
      },
    });
  }

  /** Con costo y margen se calcula el precio sin IVA; se puede ajustar a mano después. */
  private applyMargin(): void {
    const cost = numberOrNull(this.form.controls.cost.value);
    const margin = numberOrNull(this.form.controls.margin.value);
    if (cost === null || margin === null || cost < 0 || margin < 0) return;
    this.form.controls.price_without_tax.setValue(Math.round(cost * (1 + margin / 100) * 100) / 100);
  }
}

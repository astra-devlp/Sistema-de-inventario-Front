import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { PricesApi } from '../../../products.api';
import { PRICE_LISTS, Presentation, Price, PricePayload, Product, Tax, formatMoney } from '../../../products.model';

@Component({
  selector: 'app-price-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './price-form-modal.html',
})
export class PriceFormModal {
  private readonly api = inject(PricesApi);

  readonly open = input(false);
  readonly price = input<Price | null>(null);
  readonly products = input<Product[]>([]);
  readonly presentations = input<Presentation[]>([]);
  readonly taxes = input<Tax[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly priceLists = PRICE_LISTS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    price_list: new FormControl<string>('Detal', { nonNullable: true }),
    presentation_id: new FormControl('', { nonNullable: true }),
    cost: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    margin: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    price_without_tax: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
  });

  private readonly productId = signal('');
  private readonly netPrice = signal<number | null>(null);

  /** Vista previa; el valor definitivo lo calcula y guarda la API con el IVA del producto. */
  protected readonly priceWithTax = computed(() => {
    const net = this.netPrice();
    if (net === null || Number.isNaN(net)) return '';
    const product = this.products().find((p) => String(p.id) === this.productId());
    if (!product) return '';
    const tax = this.taxes().find((t) => t.id === product.tax_id);
    if (!tax) return formatMoney(net);
    return formatMoney(tax.is_exempt ? net : net * (1 + Number(tax.rate) / 100));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const price = this.price();
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
      this.netPrice.set(this.form.controls.price_without_tax.value);
    });
    const c = this.form.controls;
    c.product_id.valueChanges.subscribe((value) => this.productId.set(value));
    c.price_without_tax.valueChanges.subscribe((value) => this.netPrice.set(value));
    c.cost.valueChanges.subscribe(() => this.applyMargin());
    c.margin.valueChanges.subscribe(() => this.applyMargin());
  }

  /** Con costo y margen informados, sugiere el precio sin IVA (editable). */
  private applyMargin(): void {
    const { cost, margin } = this.form.controls;
    if (cost.value === null || margin.value === null || Number.isNaN(cost.value) || Number.isNaN(margin.value)) return;
    const net = Math.round(cost.value * (1 + margin.value / 100) * 100) / 100;
    this.form.controls.price_without_tax.setValue(net);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const c = this.form.controls;
      if (c.product_id.invalid) this.error.set('Selecciona un producto');
      else if (c.price_without_tax.invalid) this.error.set('El precio sin IVA es obligatorio y no puede ser negativo');
      else this.error.set('El costo y el margen no pueden ser negativos');
      return;
    }
    const raw = this.form.getRawValue();
    const payload: PricePayload = {
      product_id: Number(raw.product_id),
      price_list: raw.price_list,
      presentation_id: raw.presentation_id ? Number(raw.presentation_id) : null,
      cost: raw.cost === null ? null : Number(raw.cost),
      margin: raw.margin === null ? null : Number(raw.margin),
      price_without_tax: Number(raw.price_without_tax),
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.price();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
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
}

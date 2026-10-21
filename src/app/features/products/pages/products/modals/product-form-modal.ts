import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { ProductsApi } from '../../../products.api';
import { Product, ProductCatalogs, ProductPayload, formatMoney } from '../../../products.model';

const NO_CATALOGS: ProductCatalogs = { categories: [], units: [], presentations: [], taxes: [] };

@Component({
  selector: 'app-product-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './product-form-modal.html',
})
export class ProductFormModal {
  private readonly api = inject(ProductsApi);

  readonly open = input(false);
  readonly product = input<Product | null>(null);
  readonly catalogs = input<ProductCatalogs>(NO_CATALOGS);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(200)] }),
    category_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    brand: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(150)] }),
    description: new FormControl('', { nonNullable: true }),
    sku: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    barcode: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    unit_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    presentation_id: new FormControl('', { nonNullable: true }),
    cost: new FormControl<number | null>(null, { validators: [Validators.min(0)] }),
    sale_price: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0)] }),
    tax_id: new FormControl('', { nonNullable: true }),
    min_stock: new FormControl<number | null>(0, { validators: [Validators.min(0), Validators.pattern(/^\d+$/)] }),
    is_active: new FormControl('true', { nonNullable: true }),
  });

  private readonly salePrice = signal<number | null>(null);
  private readonly taxId = signal('');

  /** Vista previa; el valor definitivo lo calcula y guarda la API. */
  protected readonly priceWithTax = computed(() => {
    const price = this.salePrice();
    if (price === null || Number.isNaN(price)) return '';
    const tax = this.catalogs().taxes.find((t) => String(t.id) === this.taxId());
    if (!tax) return '';
    return formatMoney(tax.is_exempt ? price : price * (1 + Number(tax.rate) / 100));
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const product = this.product();
      this.error.set(null);
      this.form.reset({
        name: product?.name ?? '',
        category_id: product ? String(product.category_id) : '',
        brand: product?.brand ?? '',
        description: product?.description ?? '',
        sku: product?.sku ?? '',
        barcode: product?.barcode ?? '',
        unit_id: product ? String(product.unit_id) : '',
        presentation_id: product?.presentation_id ? String(product.presentation_id) : '',
        cost: product?.cost != null ? Number(product.cost) : null,
        sale_price: product ? Number(product.sale_price) : null,
        tax_id: product?.tax_id ? String(product.tax_id) : '',
        min_stock: product?.min_stock ?? 0,
        is_active: String(product?.is_active ?? true),
      });
      this.salePrice.set(this.form.controls.sale_price.value);
      this.taxId.set(this.form.controls.tax_id.value);
    });
    this.form.controls.sale_price.valueChanges.subscribe((value) => this.salePrice.set(value));
    this.form.controls.tax_id.valueChanges.subscribe((value) => this.taxId.set(value));
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const c = this.form.controls;
      if (c.name.invalid) this.error.set('El nombre es obligatorio');
      else if (c.category_id.invalid) this.error.set('Selecciona una categoría');
      else if (c.sku.invalid) this.error.set('El SKU es obligatorio');
      else if (c.unit_id.invalid) this.error.set('Selecciona una unidad de medida');
      else if (c.sale_price.invalid) this.error.set('El precio de venta es obligatorio y no puede ser negativo');
      else if (c.cost.invalid) this.error.set('El costo no puede ser negativo');
      else if (c.min_stock.invalid) this.error.set('El stock mínimo debe ser un entero mayor o igual a 0');
      else this.error.set('Revisa los campos del formulario');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: ProductPayload = {
      name: raw.name.trim(),
      category_id: Number(raw.category_id),
      sku: raw.sku.trim(),
      unit_id: Number(raw.unit_id),
      sale_price: Number(raw.sale_price),
      brand: raw.brand.trim() || null,
      description: raw.description.trim() || null,
      barcode: raw.barcode.trim() || null,
      presentation_id: raw.presentation_id ? Number(raw.presentation_id) : null,
      cost: raw.cost === null ? null : Number(raw.cost),
      tax_id: raw.tax_id ? Number(raw.tax_id) : null,
      min_stock: Number(raw.min_stock ?? 0),
      is_active: raw.is_active === 'true',
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.product();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el producto'));
      },
    });
  }
}

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { BARCODE_TYPES, Barcode, BarcodePayload, BarcodeType, Presentation, ProductOption } from '../../../catalog.model';

@Component({
  selector: 'app-barcode-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './barcode-form-modal.html',
})
export class BarcodeFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly barcode = input<Barcode | null>(null);
  readonly products = input<ProductOption[]>([]);
  readonly presentations = input<Presentation[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly barcodeTypes = BARCODE_TYPES;
  protected readonly submitting = signal(false);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly productOptions = computed(() =>
    this.products().filter((product) => product.is_active || product.id === this.barcode()?.product_id),
  );

  protected readonly form = new FormGroup({
    product_id: new FormControl('', { nonNullable: true }),
    sku: new FormControl('', { nonNullable: true }),
    code_type: new FormControl<BarcodeType>('EAN-13', { nonNullable: true }),
    code: new FormControl('', { nonNullable: true }),
    presentation_id: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const barcode = this.barcode();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          product_id: barcode ? String(barcode.product_id) : '',
          sku: barcode?.sku ?? '',
          code_type: barcode?.code_type ?? 'EAN-13',
          code: barcode?.code ?? '',
          presentation_id: barcode?.presentation_id ? String(barcode.presentation_id) : '',
        });
      });
    });

    // El SKU del código se propone con el del producto; se puede cambiar para una presentación.
    this.form.controls.product_id.valueChanges.pipe(takeUntilDestroyed()).subscribe((id) => {
      const product = this.products().find((item) => String(item.id) === id);
      if (product && !this.form.controls.sku.value.trim()) this.form.controls.sku.setValue(product.sku);
    });
  }

  protected generate(): void {
    this.generating.set(true);
    this.error.set(null);
    this.api.generateBarcode(this.form.controls.code_type.value).subscribe({
      next: (generated) => {
        this.generating.set(false);
        this.form.controls.code.setValue(generated.code);
      },
      error: (err: unknown) => {
        this.generating.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo generar el código'));
      },
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (!raw.product_id) return this.error.set('Selecciona el producto');
    if (!raw.sku.trim()) return this.error.set('El SKU es obligatorio');

    const payload: BarcodePayload = {
      product_id: Number(raw.product_id),
      sku: raw.sku.trim(),
      code_type: raw.code_type,
      code: raw.code.trim() || null,
      presentation_id: raw.presentation_id ? Number(raw.presentation_id) : null,
    };
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.barcode();
    const request = editing ? this.api.updateBarcode(editing.id, payload) : this.api.createBarcode(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el código'));
      },
    });
  }
}

import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { BarcodesApi } from '../../../products.api';
import { BARCODE_TYPES, Barcode, BarcodePayload, Presentation, Product } from '../../../products.model';

@Component({
  selector: 'app-barcode-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './barcode-form-modal.html',
})
export class BarcodeFormModal {
  private readonly api = inject(BarcodesApi);

  readonly open = input(false);
  readonly barcode = input<Barcode | null>(null);
  readonly products = input<Product[]>([]);
  readonly presentations = input<Presentation[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly codeTypes = BARCODE_TYPES;
  protected readonly submitting = signal(false);
  protected readonly generating = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    product_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    sku: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(80)] }),
    code_type: new FormControl<string>('EAN-13', { nonNullable: true }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] }),
    presentation_id: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const barcode = this.barcode();
      this.error.set(null);
      this.form.reset({
        product_id: barcode ? String(barcode.product_id) : '',
        sku: barcode?.sku ?? '',
        code_type: barcode?.code_type ?? 'EAN-13',
        code: barcode?.code ?? '',
        presentation_id: barcode?.presentation_id ? String(barcode.presentation_id) : '',
      });
    });
    // Al elegir un producto nuevo se propone su SKU.
    this.form.controls.product_id.valueChanges.subscribe((id) => {
      if (this.barcode() || this.form.controls.sku.value) return;
      const product = this.products().find((p) => String(p.id) === id);
      if (product) this.form.controls.sku.setValue(product.sku);
    });
  }

  protected generate(): void {
    this.generating.set(true);
    this.error.set(null);
    this.api.generate(this.form.controls.code_type.value).subscribe({
      next: ({ code }) => {
        this.generating.set(false);
        this.form.controls.code.setValue(code);
      },
      error: (err: unknown) => {
        this.generating.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo generar el código'));
      },
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const c = this.form.controls;
      if (c.product_id.invalid) this.error.set('Selecciona un producto');
      else if (c.sku.invalid) this.error.set('El SKU es obligatorio (máx. 80)');
      else this.error.set('El código admite hasta 80 caracteres');
      return;
    }
    const raw = this.form.getRawValue();
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
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
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

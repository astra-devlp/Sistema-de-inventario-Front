import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { TaxesApi } from '../../../products.api';
import { Tax, TaxPayload } from '../../../products.model';

@Component({
  selector: 'app-tax-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './tax-form-modal.html',
})
export class TaxFormModal {
  private readonly api = inject(TaxesApi);

  readonly open = input(false);
  readonly tax = input<Tax | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    rate: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(0), Validators.max(100)] }),
    is_exempt: new FormControl(false, { nonNullable: true }),
    is_default: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const tax = this.tax();
      this.error.set(null);
      this.form.reset({
        name: tax?.name ?? '',
        rate: tax ? Number(tax.rate) : null,
        is_exempt: tax?.is_exempt ?? false,
        is_default: tax?.is_default ?? false,
      });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    // Un IVA exento no necesita porcentaje: se envía 0.
    if (raw.is_exempt && this.form.controls.rate.value === null) this.form.controls.rate.setValue(0);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set(this.form.controls.name.invalid ? 'El nombre es obligatorio' : 'El porcentaje debe estar entre 0 y 100');
      return;
    }
    const values = this.form.getRawValue();
    const payload: TaxPayload = {
      name: values.name.trim(),
      rate: values.is_exempt ? 0 : Number(values.rate),
      is_exempt: values.is_exempt,
      is_default: values.is_default,
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.tax();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la tarifa de IVA'));
      },
    });
  }
}

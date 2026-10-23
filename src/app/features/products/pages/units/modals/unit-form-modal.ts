import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { UnitsApi } from '../../../products.api';
import { UNIT_TYPES, Unit, UnitPayload } from '../../../products.model';

@Component({
  selector: 'app-unit-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './unit-form-modal.html',
})
export class UnitFormModal {
  private readonly api = inject(UnitsApi);

  readonly open = input(false);
  readonly unit = input<Unit | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly unitTypes = UNIT_TYPES;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    abbreviation: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    unit_type: new FormControl<string>('Cantidad', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const unit = this.unit();
      this.error.set(null);
      this.form.reset({
        name: unit?.name ?? '',
        abbreviation: unit?.abbreviation ?? '',
        unit_type: unit?.unit_type ?? 'Cantidad',
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const c = this.form.controls;
      this.error.set(c.name.invalid ? 'El nombre es obligatorio' : 'La abreviatura es obligatoria (máx. 20)');
      return;
    }
    const raw = this.form.getRawValue();
    const payload: UnitPayload = {
      name: raw.name.trim(),
      abbreviation: raw.abbreviation.trim(),
      unit_type: raw.unit_type,
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.unit();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la unidad'));
      },
    });
  }
}

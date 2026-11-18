import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { Location } from '../../../location.model';
import { LocationsApi } from '../../../locations.api';

@Component({
  selector: 'app-location-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './location-form-modal.html',
})
export class LocationFormModal {
  private readonly api = inject(LocationsApi);

  readonly open = input(false);
  readonly location = input<Location | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    address: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(250)] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const location = this.location();
      this.error.set(null);
      this.form.reset({ name: location?.name ?? '', address: location?.address ?? '', phone: location?.phone ?? '' });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (this.form.invalid || !raw.name.trim()) {
      this.form.markAllAsTouched();
      this.error.set('El nombre es obligatorio (máximo 150 caracteres)');
      return;
    }
    const fields = { name: raw.name.trim(), address: raw.address.trim() || null, phone: raw.phone.trim() || null };
    const editing = this.location();

    this.submitting.set(true);
    this.error.set(null);
    const request = editing ? this.api.update(editing.id, fields) : this.api.create({ ...fields, is_active: true });
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la sede'));
      },
    });
  }
}

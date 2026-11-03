import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { UNIT_TYPES, Unit, UnitType } from '../../../catalog.model';

@Component({
  selector: 'app-unit-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './unit-form-modal.html',
})
export class UnitFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly unit = input<Unit | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly unitTypes = UNIT_TYPES;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    abbreviation: new FormControl('', { nonNullable: true }),
    unit_type: new FormControl<UnitType>('Cantidad', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const unit = this.unit();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          name: unit?.name ?? '',
          abbreviation: unit?.abbreviation ?? '',
          unit_type: unit?.unit_type ?? 'Cantidad',
        });
      });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (!raw.name.trim()) return this.error.set('El nombre es obligatorio');
    if (!raw.abbreviation.trim()) return this.error.set('La abreviatura es obligatoria');

    const payload = { name: raw.name.trim(), abbreviation: raw.abbreviation.trim(), unit_type: raw.unit_type };
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.unit();
    const request = editing ? this.api.updateUnit(editing.id, payload) : this.api.createUnit(payload);
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

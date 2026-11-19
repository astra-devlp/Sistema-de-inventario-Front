import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { UNIT_TYPES, Unit, UnitType } from '@features/products/catalog.model';
import { Modal } from '@shared/ui/modal/modal';
import { platformErrorMessage, unitBody } from '../platform-rules';
import { PlatformApi } from '../platform.api';

@Component({
  selector: 'app-unit-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './unit-form-modal.html',
})
export class UnitFormModal {
  private readonly api = inject(PlatformApi);

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
    const result = unitBody(raw.name, raw.abbreviation, raw.unit_type);
    if (!result.ok) return this.error.set(result.error);
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.unit();
    const request = editing ? this.api.updateUnit(editing.id, result.value) : this.api.createUnit(result.value);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(platformErrorMessage(err, 'No se pudo guardar la unidad'));
      },
    });
  }
}

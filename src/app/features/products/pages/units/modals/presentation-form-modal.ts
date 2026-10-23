import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { PresentationsApi } from '../../../products.api';
import { PACKAGINGS, Presentation, PresentationPayload, Unit } from '../../../products.model';

@Component({
  selector: 'app-presentation-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './presentation-form-modal.html',
})
export class PresentationFormModal {
  private readonly api = inject(PresentationsApi);

  readonly open = input(false);
  readonly presentation = input<Presentation | null>(null);
  readonly units = input<Unit[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly packagings = PACKAGINGS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    packaging: new FormControl<string>('Caja', { nonNullable: true }),
    quantity: new FormControl<number | null>(null, { validators: [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)] }),
    unit_id: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const presentation = this.presentation();
      this.error.set(null);
      this.form.reset({
        name: presentation?.name ?? '',
        packaging: presentation?.packaging ?? 'Caja',
        quantity: presentation?.quantity ?? null,
        unit_id: presentation ? String(presentation.unit_id) : '',
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const c = this.form.controls;
      if (c.name.invalid) this.error.set('El nombre es obligatorio');
      else if (c.quantity.invalid) this.error.set('La cantidad debe ser un entero mayor o igual a 1');
      else this.error.set('Selecciona la unidad base');
      return;
    }
    const raw = this.form.getRawValue();
    const payload: PresentationPayload = {
      name: raw.name.trim(),
      packaging: raw.packaging,
      quantity: Number(raw.quantity),
      unit_id: Number(raw.unit_id),
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.presentation();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la presentación'));
      },
    });
  }
}

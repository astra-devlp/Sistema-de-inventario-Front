import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { PACKAGINGS, Packaging, Presentation, PresentationPayload, Unit } from '../../../catalog.model';

@Component({
  selector: 'app-presentation-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './presentation-form-modal.html',
})
export class PresentationFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly presentation = input<Presentation | null>(null);
  readonly units = input<Unit[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly packagings = PACKAGINGS;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    packaging: new FormControl<Packaging>('Caja', { nonNullable: true }),
    quantity: new FormControl<number | null>(null),
    unit_id: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const presentation = this.presentation();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          name: presentation?.name ?? '',
          packaging: presentation?.packaging ?? 'Caja',
          quantity: presentation?.quantity ?? null,
          unit_id: presentation ? String(presentation.unit_id) : '',
        });
      });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const quantity = Number(raw.quantity);
    if (!raw.name.trim()) return this.error.set('El nombre es obligatorio');
    if (raw.quantity === null || !Number.isInteger(quantity) || quantity < 1) {
      return this.error.set('La cantidad debe ser un número entero mayor o igual a 1');
    }
    if (!raw.unit_id) return this.error.set('Selecciona la unidad base');

    const payload: PresentationPayload = {
      name: raw.name.trim(),
      packaging: raw.packaging,
      quantity,
      unit_id: Number(raw.unit_id),
    };
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.presentation();
    const request = editing ? this.api.updatePresentation(editing.id, payload) : this.api.createPresentation(payload);
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

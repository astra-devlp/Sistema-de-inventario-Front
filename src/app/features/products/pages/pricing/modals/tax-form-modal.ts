import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { Tax, TaxPayload } from '../../../catalog.model';

@Component({
  selector: 'app-tax-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './tax-form-modal.html',
})
export class TaxFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly tax = input<Tax | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    rate: new FormControl<number | null>(null),
    is_exempt: new FormControl(false, { nonNullable: true }),
    is_default: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const tax = this.tax();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          name: tax?.name ?? '',
          rate: tax ? Number(tax.rate) : null,
          is_exempt: tax?.is_exempt ?? false,
          is_default: tax?.is_default ?? false,
        });
        this.syncRate(this.form.controls.is_exempt.value);
      });
    });
    this.form.controls.is_exempt.valueChanges.pipe(takeUntilDestroyed()).subscribe((exempt) => this.syncRate(exempt));
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (!raw.name.trim()) return this.error.set('El nombre es obligatorio');
    const rate = raw.is_exempt ? 0 : Number(raw.rate);
    if (!raw.is_exempt && (raw.rate === null || Number.isNaN(rate) || rate < 0 || rate > 100)) {
      return this.error.set('El porcentaje debe estar entre 0 y 100');
    }

    const payload: TaxPayload = { name: raw.name.trim(), rate, is_exempt: raw.is_exempt, is_default: raw.is_default };
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.tax();
    const request = editing ? this.api.updateTax(editing.id, payload) : this.api.createTax(payload);
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

  /** Exento significa 0%: el porcentaje no se puede escribir. */
  private syncRate(exempt: boolean): void {
    const rate = this.form.controls.rate;
    if (exempt) {
      rate.setValue(0, { emitEvent: false });
      rate.disable({ emitEvent: false });
    } else {
      rate.enable({ emitEvent: false });
    }
  }
}

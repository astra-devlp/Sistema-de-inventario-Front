import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Tax } from '@features/products/catalog.model';
import { Modal } from '@shared/ui/modal/modal';
import { platformErrorMessage, taxBody } from '../platform-rules';
import { PlatformApi } from '../platform.api';

/** Tarifa de IVA global. No hay «por defecto» aquí: cada empresa lo elige en Configuración. */
@Component({
  selector: 'app-tax-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './tax-form-modal.html',
})
export class TaxFormModal {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly tax = input<Tax | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    rate: new FormControl('', { nonNullable: true }),
    is_exempt: new FormControl(false, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const tax = this.tax();
      untracked(() => {
        this.error.set(null);
        this.form.reset({ name: tax?.name ?? '', rate: tax ? String(Number(tax.rate)) : '', is_exempt: tax?.is_exempt ?? false });
        this.syncRate(this.form.controls.is_exempt.value);
      });
    });
    this.form.controls.is_exempt.valueChanges.pipe(takeUntilDestroyed()).subscribe((exempt) => this.syncRate(exempt));
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    const result = taxBody(raw.name, raw.rate, raw.is_exempt);
    if (!result.ok) return this.error.set(result.error);
    this.submitting.set(true);
    this.error.set(null);
    const editing = this.tax();
    const request = editing ? this.api.updateTax(editing.id, result.value) : this.api.createTax(result.value);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(platformErrorMessage(err, 'No se pudo guardar la tarifa de IVA'));
      },
    });
  }

  /** Exento significa 0%: el porcentaje no se puede escribir. */
  private syncRate(exempt: boolean): void {
    const rate = this.form.controls.rate;
    if (exempt) {
      rate.setValue('0', { emitEvent: false });
      rate.disable({ emitEvent: false });
    } else {
      rate.enable({ emitEvent: false });
    }
  }
}

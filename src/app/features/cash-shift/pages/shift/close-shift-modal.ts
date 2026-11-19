import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { formatCop, parseMoney } from '@core/money/money';
import { Modal } from '@shared/ui/modal/modal';
import { ShiftApi } from '../../shift.api';
import { Shift } from '../../shift.model';
import { ShiftResult } from './shift-result';

export interface CloseTarget {
  shift: Shift;
  /** Caja y dueño, ya resueltos para mostrar. */
  registerLabel: string;
  ownerLabel: string;
  /** Cierre del turno de otra persona (Supervisor de la sede o Administrador). */
  forced: boolean;
}

type Step = 'count' | 'confirm' | 'result';
const MAX_NOTE = 500;

/**
 * Cierre a ciegas: se captura lo contado sin conocer el esperado, se confirma (no se deshace) y solo entonces
 * la respuesta trae esperado y diferencia.
 */
@Component({
  selector: 'app-close-shift-modal',
  imports: [Modal, ReactiveFormsModule, ShiftResult],
  templateUrl: './close-shift-modal.html',
})
export class CloseShiftModal {
  private readonly api = inject(ShiftApi);

  readonly target = input<CloseTarget | null>(null);
  /** Se cierra el diálogo (con el turno ya cerrado si `closed` es true). */
  readonly dismissed = output<boolean>();

  protected readonly step = signal<Step>('count');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly counted = signal<string | null>(null);
  protected readonly result = signal<Shift | null>(null);
  protected readonly formatCop = formatCop;

  protected readonly title = computed(() => (this.target()?.forced ? 'Cierre forzado del turno' : 'Cerrar mi turno'));

  protected readonly form = new FormGroup({
    counted: new FormControl('', { nonNullable: true }),
    note: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.target()) return;
      this.step.set('count');
      this.error.set(null);
      this.counted.set(null);
      this.result.set(null);
      this.submitting.set(false);
      this.form.reset({ counted: '', note: '' });
    });
  }

  protected review(): void {
    const money = parseMoney(this.form.getRawValue().counted);
    if (!money.ok) {
      this.error.set(money.error);
      return;
    }
    if (this.form.getRawValue().note.trim().length > MAX_NOTE) {
      this.error.set(`La nota admite como máximo ${MAX_NOTE} caracteres`);
      return;
    }
    this.error.set(null);
    this.counted.set(money.value);
    this.step.set('confirm');
  }

  protected back(): void {
    this.error.set(null);
    this.step.set('count');
  }

  protected close(): void {
    const target = this.target();
    const counted = this.counted();
    if (!target || counted === null) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api.close(target.shift.id, { counted_cash: counted, note: this.form.getRawValue().note.trim() || null }).subscribe({
      next: (shift) => {
        this.submitting.set(false);
        this.result.set(shift);
        this.step.set('result');
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cerrar el turno'));
        this.step.set('count');
      },
    });
  }

  protected dismiss(): void {
    this.dismissed.emit(this.step() === 'result');
  }
}

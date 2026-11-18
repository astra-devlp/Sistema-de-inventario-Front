import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CashRegister, Location } from '../../../location.model';
import { CASH_CODE_MAX_LENGTH, normalizeCashCode } from '../../../location-rules';
import { CashRegistersApi } from '../../../locations.api';

@Component({
  selector: 'app-cash-register-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './cash-register-form-modal.html',
})
export class CashRegisterFormModal {
  private readonly api = inject(CashRegistersApi);

  readonly open = input(false);
  readonly register = input<CashRegister | null>(null);
  readonly locations = input<Location[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly codeMax = CASH_CODE_MAX_LENGTH;
  /** Solo se asignan cajas a sedes activas (la API responde 409 si no); en edición se conserva la actual. */
  protected readonly options = computed(() =>
    this.locations().filter((l) => l.is_active || l.id === this.register()?.location_id),
  );

  protected readonly form = new FormGroup({
    location_id: new FormControl<number | null>(null),
    code: new FormControl('', { nonNullable: true }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(100)] }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const register = this.register();
      this.error.set(null);
      this.form.reset({
        location_id: register?.location_id ?? this.options().find((l) => l.is_default)?.id ?? null,
        code: register?.code ?? '',
        name: register?.name ?? '',
      });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (raw.location_id === null) {
      this.error.set('Elige la sede de la caja');
      return;
    }
    if (!raw.name.trim() || this.form.invalid) {
      this.error.set('El nombre es obligatorio (máximo 100 caracteres)');
      return;
    }
    const code = normalizeCashCode(raw.code);
    if (!code.ok) {
      this.error.set(code.error);
      return;
    }

    const fields = { location_id: raw.location_id, code: code.code, name: raw.name.trim() };
    const editing = this.register();
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
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la caja'));
      },
    });
  }
}

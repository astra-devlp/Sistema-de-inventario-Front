import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { InventoryApi } from '../../../inventory.api';
import { Warehouse, WarehousePayload } from '../../../inventory.model';

@Component({
  selector: 'app-warehouse-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './warehouse-form-modal.html',
})
export class WarehouseFormModal {
  private readonly api = inject(InventoryApi);

  readonly open = input(false);
  readonly warehouse = input<Warehouse | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    code: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(20)] }),
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    address: new FormControl('', { nonNullable: true }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const warehouse = this.warehouse();
      this.error.set(null);
      this.form.reset({
        code: warehouse?.code ?? '',
        name: warehouse?.name ?? '',
        address: warehouse?.address ?? '',
        is_active: warehouse?.is_active ?? true,
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const { code, name } = this.form.controls;
      if (code.invalid) this.error.set('El código es obligatorio (máximo 20 caracteres)');
      else if (name.invalid) this.error.set('El nombre es obligatorio');
      else this.error.set('Revisa los campos del formulario');
      return;
    }

    const raw = this.form.getRawValue();
    const payload: WarehousePayload = {
      code: raw.code.trim().toUpperCase(),
      name: raw.name.trim(),
      address: raw.address.trim() || null,
      is_active: raw.is_active,
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.warehouse();
    const request = editing ? this.api.updateWarehouse(editing.id, payload) : this.api.createWarehouse(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la bodega'));
      },
    });
  }
}

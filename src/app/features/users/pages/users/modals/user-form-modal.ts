import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthUser, UserRole } from '@core/auth/auth.model';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { UserPayload, UsersApi } from '../../../users.api';

@Component({
  selector: 'app-user-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './user-form-modal.html',
})
export class UserFormModal {
  private readonly api = inject(UsersApi);

  readonly open = input(false);
  readonly user = input<AuthUser | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly roles: UserRole[] = ['Administrador', 'Usuario'];

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true }),
    role: new FormControl<UserRole>('Usuario', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const user = this.user();
      this.error.set(null);
      this.form.reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        role: user?.role ?? 'Usuario',
        phone: user?.phone ?? '',
        is_active: user?.is_active ?? true,
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const raw = this.form.getRawValue();
    const editing = this.user();
    if (!editing && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (editing && raw.password.trim() && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const payload: UserPayload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      role: raw.role,
      phone: raw.phone.trim() || null,
      is_active: raw.is_active,
    };
    if (raw.password.trim()) payload.password = raw.password;

    this.submitting.set(true);
    this.error.set(null);
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el usuario'));
      },
    });
  }
}

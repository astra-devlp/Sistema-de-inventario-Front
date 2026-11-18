import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthUser, COMPANY_ROLES, UserRole, roleLabel } from '@core/auth/auth.model';
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
  /** Pedir eliminar desde el modal de edición. */
  readonly deleteRequested = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly roles = COMPANY_ROLES;
  protected readonly roleLabel = roleLabel;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true }),
    role: new FormControl<UserRole>('Usuario', { nonNullable: true }),
    phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(/^\s*(?:(?:[\s.\-()]*\d){9,10}[\s.\-()]*)?$/)],
    }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  protected get title(): string {
    return this.user() ? 'Editar usuario' : 'Nuevo usuario';
  }

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
      const { name, email, phone } = this.form.controls;
      if (name.invalid) this.error.set('El nombre es obligatorio');
      else if (email.invalid) this.error.set('El correo no es válido');
      else if (phone.invalid) this.error.set('El teléfono debe tener entre 9 y 10 dígitos');
      else this.error.set('Revisa los campos del formulario');
      return;
    }
    const raw = this.form.getRawValue();
    const editing = this.user();
    const password = raw.password.trim();
    if ((!editing || password) && password.length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const payload: UserPayload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      role: raw.role,
      phone: raw.phone.trim() || null,
    };
    if (password) payload.password = raw.password;
    if (editing) payload.is_active = raw.is_active;

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
        this.error.set(httpErrorMessage(err, 'No se pudo guardar'));
      },
    });
  }
}

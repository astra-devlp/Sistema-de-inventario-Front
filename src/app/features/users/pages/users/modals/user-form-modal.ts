import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ACCOUNT_CREATE_ROLES, AuthUser, CLIENT_PLANS, ClientPlan, UserRole } from '@core/auth/auth.model';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { UserPayload, UsersApi } from '../../../users.api';

export type UserFormMode = 'accounts' | 'staff';

@Component({
  selector: 'app-user-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './user-form-modal.html',
})
export class UserFormModal {
  private readonly api = inject(UsersApi);

  readonly open = input(false);
  readonly user = input<AuthUser | null>(null);
  /** accounts = panel admin; staff = personal del cliente. */
  readonly mode = input<UserFormMode>('staff');
  readonly closed = output<void>();
  readonly saved = output<void>();
  /** Pedir eliminar desde el modal de edición. */
  readonly deleteRequested = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selectedRole = signal<UserRole>('Usuario');
  protected readonly selectedPlan = signal<ClientPlan>('Prueba');
  protected readonly plans = CLIENT_PLANS;

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
    plan: new FormControl<ClientPlan>('Prueba', { nonNullable: true }),
    plan_starts_at: new FormControl('', { nonNullable: true }),
  });

  protected get roles(): UserRole[] {
    if (this.mode() !== 'accounts') return ['Usuario'];
    const roles: UserRole[] = [...ACCOUNT_CREATE_ROLES];
    const current = this.user()?.role;
    // Conservar el rol legacy si se edita una cuenta ya existente.
    if (current === 'Administrador de plataforma' && !roles.includes(current)) {
      roles.push(current);
    }
    return roles;
  }

  /** Plan y fechas solo aplican a Cliente; Administrador no los tiene. */
  protected get isClientRole(): boolean {
    return this.mode() === 'accounts' && this.selectedRole() === 'Cliente';
  }

  protected get title(): string {
    if (this.mode() === 'accounts') {
      return this.user() ? 'Editar cuenta' : 'Nueva cuenta';
    }
    return this.user() ? 'Editar usuario' : 'Nuevo usuario';
  }

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const user = this.user();
      const defaultRole: UserRole = this.mode() === 'accounts' ? 'Cliente' : 'Usuario';
      this.error.set(null);
      const role: UserRole = user?.role ?? defaultRole;
      const plan: ClientPlan = user?.plan ?? 'Prueba';
      this.form.reset({
        name: user?.name ?? '',
        email: user?.email ?? '',
        password: '',
        role,
        phone: user?.phone ?? '',
        is_active: user?.is_active ?? true,
        plan,
        plan_starts_at: user?.plan_starts_at ? user.plan_starts_at.slice(0, 10) : this.todayInput(),
      });
      this.selectedRole.set(role);
      this.selectedPlan.set(plan);
      this.syncPlanStartControl(plan);
    });
  }

  protected onRoleChange(): void {
    const role = this.form.controls.role.value;
    this.selectedRole.set(role);
    if (role === 'Cliente') {
      this.syncPlanStartControl(this.form.controls.plan.value);
    }
  }

  protected onPlanChange(): void {
    const plan = this.form.controls.plan.value;
    this.selectedPlan.set(plan);
    this.syncPlanStartControl(plan);
  }

  private syncPlanStartControl(plan: ClientPlan): void {
    const control = this.form.controls.plan_starts_at;
    if (plan === 'Prueba') {
      control.setValue(this.todayInput());
      control.disable({ emitEvent: false });
    } else {
      control.enable({ emitEvent: false });
    }
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
    if (!editing && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (editing && raw.password.trim() && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const role: UserRole = this.mode() === 'staff' ? 'Usuario' : raw.role;
    if (role === 'Cliente' && raw.plan !== 'Prueba' && !raw.plan_starts_at) {
      this.error.set('La fecha de inicio del plan es obligatoria');
      return;
    }

    const payload: UserPayload = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      role,
      phone: raw.phone.trim() || null,
      is_active: raw.is_active,
    };
    if (raw.password.trim()) payload.password = raw.password;

    // Plan y fechas solo aplican a Cliente; Administrador no las envía.
    if (role === 'Cliente') {
      payload.plan = raw.plan;
      if (raw.plan === 'Prueba') {
        payload.plan_starts_at = new Date().toISOString();
      } else {
        payload.plan_starts_at = new Date(`${raw.plan_starts_at}T00:00:00`).toISOString();
      }
    } else {
      payload.plan = null;
      payload.plan_starts_at = null;
    }

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

  private todayInput(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

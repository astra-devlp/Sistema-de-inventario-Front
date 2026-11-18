import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { userContextLabel } from '@core/auth/auth.model';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { UsersApi } from '@features/users/users.api';

/** Teléfono opcional: vacío o 9–10 dígitos. */
const OPTIONAL_PHONE = /^\s*(?:(?:[\s.\-()]*\d){9,10}[\s.\-()]*)?$/;

@Component({
  selector: 'app-account-page',
  imports: [ReactiveFormsModule],
  templateUrl: './account-page.html',
})
export class AccountPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(UsersApi);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly user = this.auth.user;
  protected readonly initial = computed(() =>
    (this.user()?.name.trim().charAt(0) || 'U').toUpperCase(),
  );
  /** Cliente/Usuario: nombre de tienda en lugar del rol. */
  protected readonly contextLabel = computed(() => userContextLabel(this.user()));

  /** Cliente edita; Usuario solo ve el local del dueño. */
  protected readonly showBusiness = computed(() => {
    const role = this.user()?.role;
    return role === 'Cliente' || role === 'Usuario';
  });
  protected readonly canEditBusiness = computed(() => this.user()?.role === 'Cliente');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(OPTIONAL_PHONE)] }),
    password: new FormControl('', { nonNullable: true }),
    business_name: new FormControl('', { nonNullable: true }),
    business_nit: new FormControl('', { nonNullable: true }),
    business_phone: new FormControl('', {
      nonNullable: true,
      validators: [Validators.pattern(OPTIONAL_PHONE)],
    }),
    business_address: new FormControl('', { nonNullable: true }),
    business_city: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const user = this.user();
      if (!user) return;
      this.form.patchValue({
        name: user.name,
        email: user.email,
        phone: user.phone ?? '',
        password: '',
        business_name: user.business_name ?? '',
        business_nit: user.business_nit ?? '',
        business_phone: user.business_phone ?? '',
        business_address: user.business_address ?? '',
        business_city: user.business_city ?? '',
      });
    });

    // Personal: refresca /me para traer datos del local del Cliente dueño.
    if (this.showBusiness()) {
      this.api.me().subscribe({
        next: (me) => this.auth.setUser(me),
        error: () => undefined,
      });
    }
  }

  protected display(value: string | null | undefined): string {
    const text = (value ?? '').trim();
    return text || '—';
  }

  protected submit(): void {
    const user = this.user();
    if (!user) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const { name, email, phone, business_phone } = this.form.controls;
      if (name.invalid) this.error.set('El nombre es obligatorio');
      else if (email.invalid) this.error.set('El correo no es válido');
      else if (phone.invalid) this.error.set('El teléfono debe tener entre 9 y 10 dígitos');
      else if (this.canEditBusiness() && business_phone.invalid) {
        this.error.set('El teléfono del local debe tener entre 9 y 10 dígitos');
      } else this.error.set('Revisa los campos del formulario');
      return;
    }
    const raw = this.form.getRawValue();
    if (raw.password.trim() && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const payload: {
      name: string;
      email: string;
      phone: string | null;
      password?: string;
      business_name?: string | null;
      business_nit?: string | null;
      business_phone?: string | null;
      business_address?: string | null;
      business_city?: string | null;
    } = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || null,
    };
    if (raw.password.trim()) payload.password = raw.password.trim();

    if (user.role === 'Cliente') {
      payload.business_name = raw.business_name.trim() || null;
      payload.business_nit = raw.business_nit.trim() || null;
      payload.business_phone = raw.business_phone.trim() || null;
      payload.business_address = raw.business_address.trim() || null;
      payload.business_city = raw.business_city.trim() || null;
    }

    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);
    this.api.update(user.id, payload).subscribe({
      next: (updated) => {
        this.auth.setUser(updated);
        this.form.patchValue({ password: '' });
        this.submitting.set(false);
        this.success.set(
          payload.password ? 'Cuenta y contraseña actualizadas.' : 'Cuenta actualizada.',
        );
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la cuenta'));
      },
    });
  }
}

import { Component, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { UsersApi } from '@features/users/users.api';
import { PageHeader } from '@shared/ui/page-header/page-header';

/** Teléfono opcional: vacío o 9–10 dígitos. */
const OPTIONAL_PHONE = /^\s*(?:(?:[\s.\-()]*\d){9,10}[\s.\-()]*)?$/;

@Component({
  selector: 'app-account-page',
  imports: [PageHeader, ReactiveFormsModule],
  templateUrl: './account-page.html',
})
export class AccountPage {
  private readonly auth = inject(AuthService);
  private readonly api = inject(UsersApi);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly user = this.auth.user;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(OPTIONAL_PHONE)] }),
    password: new FormControl('', { nonNullable: true }),
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
      });
    });
  }

  protected submit(): void {
    const user = this.user();
    if (!user) return;
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
    if (raw.password.trim() && raw.password.trim().length < 8) {
      this.error.set('La contraseña debe tener al menos 8 caracteres');
      return;
    }

    const payload: {
      name: string;
      email: string;
      phone: string | null;
      password?: string;
    } = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || null,
    };
    if (raw.password.trim()) payload.password = raw.password.trim();

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

import { Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { httpErrorMessage, AuthService } from '@core/auth/auth.service';
import { ThemeService } from '@core/theme/theme.service';

@Component({
  selector: 'app-login-page',
  imports: [ReactiveFormsModule],
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  protected readonly theme = inject(ThemeService);

  protected readonly submitting = signal(false);
  protected readonly showPassword = signal(false);
  protected readonly points = [
    { icon: 'inventory_2', label: 'Productos, precios y códigos' },
    { icon: 'warehouse', label: 'Existencias por bodega' },
    { icon: 'swap_horiz', label: 'Entradas, salidas y traslados' },
  ];
  protected readonly error = signal<string | null>(
    this.route.snapshot.queryParamMap.has('expired') ? 'Tu sesión expiró. Ingresa de nuevo.' : null,
  );

  protected readonly form = new FormGroup({
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    password: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.minLength(8)] }),
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('Revisa el correo y usa una contraseña de al menos 8 caracteres');
      return;
    }

    const { email, password } = this.form.getRawValue();
    this.submitting.set(true);
    this.error.set(null);
    this.auth.login(email.trim(), password).subscribe({
      next: () => {
        this.submitting.set(false);
        void this.router.navigateByUrl(this.auth.homePath());
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo iniciar sesión'));
      },
    });
  }
}

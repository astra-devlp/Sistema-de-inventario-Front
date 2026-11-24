import { Component, computed, effect, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { roleLabel, userContextLabel } from '@core/auth/auth.model';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { CompanyService } from '@core/company/company.service';
import { validReturnWindow } from '@features/locations/location-rules';
import { UsersApi } from '@features/users/users.api';
import { lockedMessage, newPasswordError } from '@core/auth/password-rules';

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
  private readonly companyApi = inject(CompanyService);

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly user = this.auth.user;
  protected readonly company = this.auth.company;
  protected readonly roleLabel = roleLabel;
  protected readonly initial = computed(() => (this.user()?.name.trim().charAt(0) || 'U').toUpperCase());
  /** «Empresa · Rol» (plataforma: solo el rol). */
  protected readonly contextLabel = computed(() => userContextLabel(this.user(), this.company()));

  /** La API solo deja al Administrador de la empresa cambiar usuarios y los datos de su empresa. */
  protected readonly canEdit = computed(() => this.auth.isCompanyAdmin());
  /** El administrador de plataforma no tiene empresa. */
  protected readonly showBusiness = computed(() => this.company() !== null);

  protected readonly profileForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    email: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.email] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(OPTIONAL_PHONE)] }),
  });

  protected readonly companyForm = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(OPTIONAL_PHONE)] }),
    address: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    return_window_days: new FormControl<number | null>(0),
  });

  constructor() {
    effect(() => {
      const user = this.user();
      if (!user) return;
      this.profileForm.patchValue({ name: user.name, email: user.email, phone: user.phone ?? '' });
      if (this.canEdit()) this.profileForm.enable({ emitEvent: false });
      else this.profileForm.disable({ emitEvent: false });
    });

    effect(() => {
      const company = this.company();
      if (!company) return;
      this.companyForm.patchValue({
        name: company.name,
        phone: company.phone ?? '',
        address: company.address ?? '',
        city: company.city ?? '',
        return_window_days: company.return_window_days,
      });
      if (this.canEdit()) this.companyForm.enable({ emitEvent: false });
      else this.companyForm.disable({ emitEvent: false });
    });

    // Datos al día de la empresa (nombre, teléfono…): se leen de la API cada vez que se abre la pantalla.
    this.auth.refreshPlan().subscribe();
  }

  protected display(value: string | null | undefined): string {
    const text = (value ?? '').trim();
    return text || '—';
  }

  protected submitProfile(): void {
    const user = this.user();
    if (!user || !this.canEdit()) return;
    const form = this.profileForm;
    if (form.invalid) {
      form.markAllAsTouched();
      const { name, email, phone } = form.controls;
      if (name.invalid) this.error.set('El nombre es obligatorio');
      else if (email.invalid) this.error.set('El correo no es válido');
      else if (phone.invalid) this.error.set('El teléfono debe tener entre 9 y 10 dígitos');
      else this.error.set('Revisa los campos del formulario');
      return;
    }
    const raw = form.getRawValue();
    const payload: { name: string; email: string; phone: string | null } = {
      name: raw.name.trim(),
      email: raw.email.trim(),
      phone: raw.phone.trim() || null,
    };

    this.begin();
    this.api.update(user.id, payload).subscribe({
      next: (updated) => {
        this.auth.setUser(updated);
        this.submitting.set(false);
        this.success.set('Cuenta actualizada.');
      },
      error: (err: unknown) => this.fail(err, 'No se pudo guardar la cuenta'),
    });
  }

  /** Cambiar la propia contraseña: cualquier rol, también con el plan vencido. Pide la actual. */
  protected readonly passwordForm = new FormGroup({
    current: new FormControl('', { nonNullable: true }),
    next: new FormControl('', { nonNullable: true }),
    confirm: new FormControl('', { nonNullable: true }),
  });
  protected readonly passwordError = signal<string | null>(null);
  protected readonly passwordSuccess = signal<string | null>(null);
  protected readonly changingPassword = signal(false);

  protected submitPassword(): void {
    const { current, next, confirm } = this.passwordForm.getRawValue();
    this.passwordSuccess.set(null);
    const problem = newPasswordError(current, next, confirm);
    if (problem) {
      this.passwordError.set(problem);
      return;
    }
    this.passwordError.set(null);
    this.changingPassword.set(true);
    this.auth.changeOwnPassword(current, next).subscribe({
      next: () => {
        this.changingPassword.set(false);
        this.passwordForm.reset({ current: '', next: '', confirm: '' });
        this.passwordSuccess.set('Contraseña actualizada. Úsala la próxima vez que inicies sesión.');
      },
      error: (err: unknown) => {
        this.changingPassword.set(false);
        this.passwordError.set(lockedMessage(err, 'No se pudo cambiar la contraseña'));
      },
    });
  }

  /** Solo nombre, teléfono, dirección y ciudad: el NIT y la razón social los cambia plataforma (422). */
  protected submitCompany(): void {
    if (!this.canEdit()) return;
    const form = this.companyForm;
    if (form.invalid) {
      form.markAllAsTouched();
      const { name, phone } = form.controls;
      if (name.invalid) this.error.set('El nombre de la empresa es obligatorio');
      else if (phone.invalid) this.error.set('El teléfono del local debe tener entre 9 y 10 dígitos');
      else this.error.set('Revisa los campos del formulario');
      return;
    }
    const raw = form.getRawValue();
    if (!validReturnWindow(raw.return_window_days)) {
      this.error.set('El plazo de devolución es un número entero de días entre 0 y 365');
      return;
    }

    this.begin();
    this.companyApi
      .update({
        name: raw.name.trim(),
        phone: raw.phone.trim() || null,
        address: raw.address.trim() || null,
        city: raw.city.trim() || null,
        return_window_days: raw.return_window_days as number,
      })
      .subscribe({
        next: (company) => {
          this.auth.setCompany(company);
          this.submitting.set(false);
          this.success.set('Datos de la empresa actualizados.');
        },
        error: (err: unknown) => this.fail(err, 'No se pudieron guardar los datos de la empresa'),
      });
  }

  private begin(): void {
    this.submitting.set(true);
    this.error.set(null);
    this.success.set(null);
  }

  private fail(err: unknown, fallback: string): void {
    this.submitting.set(false);
    this.error.set(httpErrorMessage(err, fallback));
  }
}

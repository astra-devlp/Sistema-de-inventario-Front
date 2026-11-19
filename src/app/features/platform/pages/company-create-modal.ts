import { Component, ElementRef, effect, inject, input, output, signal, untracked, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Modal } from '@shared/ui/modal/modal';
import { PLANS, PLAN_END_NOTE, createCompanyBody, platformErrorMessage } from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { PlatformCompany } from '../platform.model';

/**
 * Alta de empresa: plan y vencimiento obligatorios, y crea el primer Administrador. La contraseña inicial se lee del
 * campo al enviar y se borra en ese mismo instante: no pasa por el formulario, ninguna señal ni almacenamiento.
 */
@Component({
  selector: 'app-company-create-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './company-create-modal.html',
})
export class CompanyCreateModal {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly closed = output<void>();
  readonly saved = output<PlatformCompany>();

  protected readonly plans = PLANS;
  protected readonly planNote = PLAN_END_NOTE;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  private readonly passwordField = viewChild<ElementRef<HTMLInputElement>>('password');

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    legal_name: new FormControl('', { nonNullable: true }),
    tax_id: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    plan: new FormControl('mensual', { nonNullable: true }),
    expires_on: new FormControl('', { nonNullable: true }),
    admin_name: new FormControl('', { nonNullable: true }),
    admin_email: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.error.set(null);
        this.form.reset();
        this.form.controls.plan.setValue('mensual');
        this.clearPassword();
      });
    });
  }

  private clearPassword(): void {
    const field = this.passwordField()?.nativeElement;
    if (field) field.value = '';
  }

  protected dismiss(): void {
    this.clearPassword();
    this.closed.emit();
  }

  protected submit(): void {
    if (this.submitting()) return;
    const field = this.passwordField()?.nativeElement;
    const password = field?.value ?? '';
    const result = createCompanyBody(this.form.getRawValue(), password);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    // Se borra al enviar: si la API lo rechaza, se escribe de nuevo.
    if (field) field.value = '';
    this.submitting.set(true);
    this.error.set(null);
    this.api.createCompany(result.value).subscribe({
      next: (company) => {
        this.submitting.set(false);
        this.saved.emit(company);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(platformErrorMessage(err, 'No se pudo crear la empresa'));
      },
    });
  }
}

import { Component, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Modal } from '@shared/ui/modal/modal';
import { companyPatchBody, platformErrorMessage } from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { PlatformCompany } from '../platform.model';

/** Datos de la empresa con `PATCH /platform/companies/{id}`. El plan no va aquí: se renueva en su propio modal. */
@Component({
  selector: 'app-company-edit-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './company-edit-modal.html',
})
export class CompanyEditModal {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly company = input<PlatformCompany | null>(null);
  readonly closed = output<void>();
  readonly saved = output<PlatformCompany>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    legal_name: new FormControl('', { nonNullable: true }),
    tax_id: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    address: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const company = this.company();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          name: company?.name ?? '',
          legal_name: company?.legal_name ?? '',
          tax_id: company?.tax_id ?? '',
          phone: company?.phone ?? '',
          address: company?.address ?? '',
          city: company?.city ?? '',
        });
      });
    });
  }

  protected submit(): void {
    const company = this.company();
    if (!company || this.submitting()) return;
    const result = companyPatchBody(this.form.getRawValue());
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.updateCompany(company.id, result.value).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.saved.emit(updated);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(platformErrorMessage(err, 'No se pudieron guardar los datos de la empresa'));
      },
    });
  }
}

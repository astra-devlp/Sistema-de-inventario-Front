import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CustomersApi } from '../../../customers.api';
import { Customer, CustomerPayload, DOCUMENT_TYPES, DocumentTypeOption, NIT_CODE, groupDocumentTypes } from '../../../customers.model';

@Component({
  selector: 'app-customer-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './customer-form-modal.html',
})
export class CustomerFormModal {
  private readonly api = inject(CustomersApi);

  readonly open = input(false);
  readonly customer = input<Customer | null>(null);
  readonly documentTypes = input<DocumentTypeOption[]>(DOCUMENT_TYPES);
  protected readonly documentTypeGroups = computed(() => groupDocumentTypes(this.documentTypes()));
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly documentType = signal('13');
  protected readonly nitCode = NIT_CODE;

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    document_type: new FormControl('13', { nonNullable: true, validators: [Validators.required] }),
    document_number: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    check_digit: new FormControl('', { nonNullable: true }),
    // Igual que EmailStr en la API: exige dominio con punto (juan@correo.com, no juan@correo).
    email: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\s*[^\s@]+@[^\s@]+\.[^\s@]+\s*$/)] }),
    // Igual que la API: separadores opcionales y entre 9 y 10 dígitos.
    phone: new FormControl('', { nonNullable: true, validators: [Validators.pattern(/^\s*(?:[\s.\-()]*\d){9,10}[\s.\-()]*$/)] }),
    address: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const customer = this.customer();
      this.error.set(null);
      const documentType = customer?.document_type ?? '13';
      this.documentType.set(documentType);
      this.form.reset({
        name: customer?.name ?? '',
        document_type: documentType,
        document_number: customer?.document_number ?? '',
        check_digit: customer?.check_digit ?? '',
        email: customer?.email ?? '',
        phone: customer?.phone ?? '',
        address: customer?.address ?? '',
      });
    });
  }

  protected onDocumentType(event: Event): void {
    this.documentType.set((event.target as HTMLSelectElement).value);
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      const { name, document_number, email, phone } = this.form.controls;
      if (name.invalid) this.error.set('El nombre es obligatorio');
      else if (document_number.invalid) this.error.set('El número de documento es obligatorio');
      else if (email.invalid) this.error.set('El correo no es válido (ejemplo: nombre@dominio.com)');
      else if (phone.invalid) this.error.set('El teléfono debe tener entre 9 y 10 dígitos');
      else this.error.set('Revisa los campos del formulario');
      return;
    }
    const raw = this.form.getRawValue();
    if (raw.document_type === NIT_CODE && !raw.check_digit.trim()) {
      this.error.set('El NIT requiere el dígito de verificación');
      return;
    }

    const payload: CustomerPayload = {
      name: raw.name.trim(),
      document_type: raw.document_type,
      document_number: raw.document_number.trim(),
      check_digit: raw.document_type === NIT_CODE ? raw.check_digit.trim() : null,
      email: raw.email.trim() || null,
      phone: raw.phone.trim() || null,
      address: raw.address.trim() || null,
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.customer();
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar el cliente'));
      },
    });
  }
}

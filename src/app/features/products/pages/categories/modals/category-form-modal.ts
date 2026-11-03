import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CatalogApi } from '../../../catalog.api';
import { Category, CategoryPayload } from '../../../catalog.model';

@Component({
  selector: 'app-category-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './category-form-modal.html',
})
export class CategoryFormModal {
  private readonly api = inject(CatalogApi);

  readonly open = input(false);
  readonly category = input<Category | null>(null);
  readonly categories = input<Category[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  /** Una categoría no puede ser su propia madre; la API también rechaza ciclos más largos. */
  protected readonly parentOptions = computed(() => this.categories().filter((option) => option.id !== this.category()?.id));

  protected readonly form = new FormGroup({
    name: new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(150)] }),
    code: new FormControl('', { nonNullable: true, validators: [Validators.maxLength(50)] }),
    parent_id: new FormControl('', { nonNullable: true }),
    description: new FormControl('', { nonNullable: true }),
    is_active: new FormControl(true, { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const category = this.category();
      untracked(() => {
        this.error.set(null);
        this.form.reset({
          name: category?.name ?? '',
          code: category?.code ?? '',
          parent_id: category?.parent_id ? String(category.parent_id) : '',
          description: category?.description ?? '',
          is_active: category?.is_active ?? true,
        });
      });
    });
  }

  protected submit(): void {
    const raw = this.form.getRawValue();
    if (!raw.name.trim()) return this.error.set('El nombre es obligatorio');
    if (this.form.invalid) return this.error.set('Revisa la longitud del nombre (150) y del código (50)');

    const payload: CategoryPayload = {
      name: raw.name.trim(),
      code: raw.code.trim() || null,
      parent_id: raw.parent_id ? Number(raw.parent_id) : null,
      description: raw.description.trim() || null,
      is_active: raw.is_active,
    };

    this.submitting.set(true);
    this.error.set(null);
    const editing = this.category();
    const request = editing ? this.api.updateCategory(editing.id, payload) : this.api.createCategory(payload);
    request.subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo guardar la categoría'));
      },
    });
  }
}

import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { CategoriesApi } from '../../../products.api';
import { Category, CategoryPayload } from '../../../products.model';

@Component({
  selector: 'app-category-form-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './category-form-modal.html',
})
export class CategoryFormModal {
  private readonly api = inject(CategoriesApi);

  readonly open = input(false);
  readonly category = input<Category | null>(null);
  readonly categories = input<Category[]>([]);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Al editar se excluye la propia categoría para no poder elegirse como padre. */
  protected readonly parents = computed(() => this.categories().filter((c) => c.id !== this.category()?.id));

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
      this.error.set(null);
      this.form.reset({
        name: category?.name ?? '',
        code: category?.code ?? '',
        parent_id: category?.parent_id ? String(category.parent_id) : '',
        description: category?.description ?? '',
        is_active: category?.is_active ?? true,
      });
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.error.set('El nombre es obligatorio (máx. 150) y el código admite hasta 50 caracteres');
      return;
    }
    const raw = this.form.getRawValue();
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
    const request = editing ? this.api.update(editing.id, payload) : this.api.create(payload);
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

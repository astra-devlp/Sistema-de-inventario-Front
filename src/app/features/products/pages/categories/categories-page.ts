import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CatalogApi } from '../../catalog.api';
import { Category, ProductOption } from '../../catalog.model';
import { CategoryFormModal } from './modals/category-form-modal';

type CategoryModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-categories-page',
  imports: [PageHeader, Icon, CategoryFormModal, ConfirmModal],
  templateUrl: './categories-page.html',
})
export class CategoriesPage {
  private readonly api = inject(CatalogApi);

  protected readonly categories = signal<Category[]>([]);
  /** Todas las categorías, sin filtro: para nombrar al padre y llenar el selector del formulario. */
  protected readonly allCategories = signal<Category[]>([]);
  private readonly products = signal<ProductOption[]>([]);
  protected readonly query = signal('');
  protected readonly isActive = signal<boolean | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<CategoryModal>(null);
  protected readonly selected = signal<Category | null>(null);

  private readonly names = computed(() => new Map(this.allCategories().map((category) => [category.id, category.name])));
  private readonly productCounts = computed(() => {
    const counts = new Map<number, number>();
    for (const product of this.products()) counts.set(product.category_id, (counts.get(product.category_id) ?? 0) + 1);
    return counts;
  });

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.reload();
  }

  protected parentName(category: Category): string {
    return category.parent_id === null ? '—' : (this.names().get(category.parent_id) ?? '—');
  }

  protected productCount(category: Category): number {
    return this.productCounts().get(category.id) ?? 0;
  }

  protected open(modal: CategoryModal, category: Category | null = null): void {
    this.selected.set(category);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  protected onStatus(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.isActive.set(value === '' ? null : value === 'true');
    this.load();
  }

  protected saved(): void {
    this.close();
    this.reload();
  }

  protected remove(): void {
    const category = this.selected();
    if (!category) return;
    this.api.deleteCategory(category.id).subscribe({
      next: () => {
        this.close();
        this.reload();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar la categoría'));
      },
    });
  }

  private reload(): void {
    this.api.categories().subscribe({ next: (categories) => this.allCategories.set(categories) });
    this.api.products().subscribe({ next: (products) => this.products.set(products) });
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.categories({ name: this.query(), isActive: this.isActive() }).subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las categorías'));
      },
    });
  }
}

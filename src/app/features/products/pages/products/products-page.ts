import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProductsApi } from '../../products.api';
import { Product, ProductCatalogs, ProductStats, formatMoney } from '../../products.model';
import { ProductDetailModal } from './modals/product-detail-modal';
import { ProductFormModal } from './modals/product-form-modal';

type ProductModal = 'create' | 'edit' | 'detail' | 'delete' | null;

const EMPTY_CATALOGS: ProductCatalogs = { categories: [], units: [], presentations: [], taxes: [] };

@Component({
  selector: 'app-products-page',
  imports: [PageHeader, Icon, ProductFormModal, ProductDetailModal, ConfirmModal],
  templateUrl: './products-page.html',
})
export class ProductsPage {
  private readonly api = inject(ProductsApi);

  protected readonly products = signal<Product[]>([]);
  protected readonly stats = signal<ProductStats | null>(null);
  protected readonly catalogs = signal<ProductCatalogs>(EMPTY_CATALOGS);
  protected readonly query = signal('');
  protected readonly categoryId = signal<number | null>(null);
  protected readonly isActive = signal<boolean | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<ProductModal>(null);
  protected readonly selected = signal<Product | null>(null);
  protected readonly formatMoney = formatMoney;

  private readonly categoryNames = computed(() => new Map(this.catalogs().categories.map((c) => [c.id, c.name])));
  private readonly taxById = computed(() => new Map(this.catalogs().taxes.map((t) => [t.id, t])));
  private readonly presentationNames = computed(() => new Map(this.catalogs().presentations.map((p) => [p.id, p.name])));

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.api.catalogs().subscribe({
      next: (catalogs) => this.catalogs.set(catalogs),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar categorías, unidades e IVA')),
    });
    this.reload();
  }

  protected categoryName(product: Product): string {
    return this.categoryNames().get(product.category_id) ?? '—';
  }

  protected presentationName(product: Product): string {
    return product.presentation_id === null ? 'Unidad suelta' : (this.presentationNames().get(product.presentation_id) ?? '—');
  }

  protected unitName(product: Product): string {
    const unit = this.catalogs().units.find((u) => u.id === product.unit_id);
    return unit ? `${unit.name} (${unit.abbreviation})` : '—';
  }

  protected taxLabel(product: Product): string {
    if (product.tax_id === null) return '—';
    const tax = this.taxById().get(product.tax_id);
    if (!tax) return '—';
    return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
  }

  protected open(modal: ProductModal, product: Product | null = null): void {
    this.selected.set(product);
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

  protected onCategory(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.categoryId.set(value === '' ? null : Number(value));
    this.load();
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
    const product = this.selected();
    if (!product) return;
    this.api.delete(product.id).subscribe({
      next: () => {
        this.close();
        this.reload();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar el producto'));
      },
    });
  }

  private reload(): void {
    this.load();
    this.api.stats().subscribe({
      next: (stats) => this.stats.set(stats),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las estadísticas')),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list({ query: this.query(), categoryId: this.categoryId(), isActive: this.isActive() }).subscribe({
      next: (products) => {
        this.products.set(products);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los productos'));
      },
    });
  }
}

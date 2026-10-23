import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { BarcodesApi, PresentationsApi, ProductsApi } from '../../products.api';
import { BARCODE_TYPES, Barcode, Presentation, Product } from '../../products.model';
import { BarcodeFormModal } from './modals/barcode-form-modal';

type BarcodeModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-barcodes-page',
  imports: [PageHeader, Icon, BarcodeFormModal, ConfirmModal],
  templateUrl: './barcodes-page.html',
})
export class BarcodesPage {
  private readonly api = inject(BarcodesApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly presentationsApi = inject(PresentationsApi);

  protected readonly codeTypes = BARCODE_TYPES;
  protected readonly barcodes = signal<Barcode[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly query = signal('');
  protected readonly codeType = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<BarcodeModal>(null);
  protected readonly selected = signal<Barcode | null>(null);

  private readonly productNames = computed(() => new Map(this.products().map((p) => [p.id, p.name])));
  private readonly presentationNames = computed(() => new Map(this.presentations().map((p) => [p.id, p.name])));

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.productsApi.list({ query: '', categoryId: null, isActive: null }).subscribe({
      next: (products) => this.products.set(products),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar los productos')),
    });
    this.presentationsApi.list().subscribe({
      next: (presentations) => this.presentations.set(presentations),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las presentaciones')),
    });
    this.load();
  }

  protected productName(barcode: Barcode): string {
    return this.productNames().get(barcode.product_id) ?? '—';
  }

  protected presentationName(barcode: Barcode): string {
    return barcode.presentation_id === null ? 'Unidad suelta' : (this.presentationNames().get(barcode.presentation_id) ?? '—');
  }

  protected open(modal: BarcodeModal, barcode: Barcode | null = null): void {
    this.selected.set(barcode);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected print(): void {
    window.print();
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  protected onCodeType(event: Event): void {
    this.codeType.set((event.target as HTMLSelectElement).value);
    this.load();
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const barcode = this.selected();
    if (!barcode) return;
    this.api.delete(barcode.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar el código'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list(this.query(), this.codeType()).subscribe({
      next: (barcodes) => {
        this.barcodes.set(barcodes);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los códigos'));
      },
    });
  }
}

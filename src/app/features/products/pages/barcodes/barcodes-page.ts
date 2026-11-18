import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CatalogApi } from '../../catalog.api';
import { BARCODE_TYPES, Barcode, BarcodeType, Presentation, ProductOption } from '../../catalog.model';
import { BarcodeFormModal } from './modals/barcode-form-modal';

type BarcodeModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-barcodes-page',
  imports: [PageHeader, Icon, BarcodeFormModal, ConfirmModal],
  templateUrl: './barcodes-page.html',
})
export class BarcodesPage {
  private readonly api = inject(CatalogApi);

  protected readonly barcodes = signal<Barcode[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly query = signal('');
  protected readonly codeType = signal<BarcodeType | ''>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<BarcodeModal>(null);
  protected readonly selected = signal<Barcode | null>(null);
  protected readonly barcodeTypes = BARCODE_TYPES;

  private readonly productNames = computed(() => new Map(this.products().map((product) => [product.id, product.name])));
  private readonly presentationNames = computed(() => new Map(this.presentations().map((p) => [p.id, p.name])));

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.api.products().subscribe({ next: (products) => this.products.set(products) });
    this.api.presentations().subscribe({ next: (presentations) => this.presentations.set(presentations) });
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

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(), 250);
  }

  protected onType(event: Event): void {
    this.codeType.set((event.target as HTMLSelectElement).value as BarcodeType | '');
    this.load();
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const barcode = this.selected();
    if (!barcode) return;
    this.api.deleteBarcode(barcode.id).subscribe({
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
    this.api.barcodes({ query: this.query(), codeType: this.codeType() }).subscribe({
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

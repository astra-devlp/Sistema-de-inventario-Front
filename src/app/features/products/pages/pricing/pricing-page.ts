import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CatalogApi } from '../../catalog.api';
import { PRICE_LISTS, Presentation, Price, PriceList, ProductOption, Tax, taxLabel } from '../../catalog.model';
import { formatMoney } from '../../products.model';
import { PriceFormModal } from './modals/price-form-modal';
import { TaxFormModal } from './modals/tax-form-modal';

type PricingModal = 'price-create' | 'price-edit' | 'tax-create' | 'tax-edit' | 'delete' | null;

type Deletion = { kind: 'price'; item: Price } | { kind: 'tax'; item: Tax };

@Component({
  selector: 'app-pricing-page',
  imports: [PageHeader, Icon, PriceFormModal, TaxFormModal, ConfirmModal],
  templateUrl: './pricing-page.html',
})
export class PricingPage {
  private readonly api = inject(CatalogApi);

  protected readonly prices = signal<Price[]>([]);
  protected readonly taxes = signal<Tax[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly query = signal('');
  protected readonly priceList = signal<PriceList | ''>('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<PricingModal>(null);
  protected readonly selectedPrice = signal<Price | null>(null);
  protected readonly selectedTax = signal<Tax | null>(null);
  protected readonly deletion = signal<Deletion | null>(null);

  protected readonly priceLists = PRICE_LISTS;
  protected readonly formatMoney = formatMoney;

  private readonly productById = computed(() => new Map(this.products().map((product) => [product.id, product])));
  private readonly taxById = computed(() => new Map(this.taxes().map((tax) => [tax.id, tax])));
  private readonly presentationNames = computed(() => new Map(this.presentations().map((p) => [p.id, p.name])));

  /** La búsqueda por producto se hace aquí: la lista de precios no trae el nombre del producto. */
  protected readonly visiblePrices = computed(() => {
    const term = this.query().trim().toLowerCase();
    if (!term) return this.prices();
    return this.prices().filter((price) => {
      const product = this.productById().get(price.product_id);
      return !!product && (product.name.toLowerCase().includes(term) || product.sku.toLowerCase().includes(term));
    });
  });

  constructor() {
    this.api.products().subscribe({ next: (products) => this.products.set(products) });
    this.api.presentations().subscribe({ next: (presentations) => this.presentations.set(presentations) });
    this.loadTaxes();
    this.loadPrices();
  }

  protected productName(price: Price): string {
    return this.productById().get(price.product_id)?.name ?? '—';
  }

  protected presentationName(price: Price): string {
    return price.presentation_id === null ? 'Unidad suelta' : (this.presentationNames().get(price.presentation_id) ?? '—');
  }

  protected priceTaxLabel(price: Price): string {
    const product = this.productById().get(price.product_id);
    return taxLabel(product?.tax_id != null ? this.taxById().get(product.tax_id) : undefined);
  }

  protected taxRate(tax: Tax): string {
    return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
  }

  protected margin(price: Price): string {
    return price.margin === null ? '—' : `${Number(price.margin)}%`;
  }

  protected editPrice(price: Price | null): void {
    this.selectedPrice.set(price);
    this.modal.set(price ? 'price-edit' : 'price-create');
  }

  protected editTax(tax: Tax | null): void {
    this.selectedTax.set(tax);
    this.modal.set(tax ? 'tax-edit' : 'tax-create');
  }

  protected askDelete(deletion: Deletion): void {
    this.deletion.set(deletion);
    this.modal.set('delete');
  }

  protected deleteMessage(): string {
    const deletion = this.deletion();
    if (!deletion) return '¿Deseas eliminar este registro?';
    if (deletion.kind === 'tax') return `¿Deseas eliminar la tarifa ${deletion.item.name}?`;
    return `¿Deseas eliminar el precio ${deletion.item.price_list} de ${this.productName(deletion.item)}?`;
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onList(event: Event): void {
    this.priceList.set((event.target as HTMLSelectElement).value as PriceList | '');
    this.loadPrices();
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedPrice.set(null);
    this.selectedTax.set(null);
    this.deletion.set(null);
  }

  protected savedPrice(): void {
    this.close();
    this.loadPrices();
  }

  /** Cambiar una tarifa puede cambiar la tarifa por defecto o el precio con IVA: se recarga todo. */
  protected savedTax(): void {
    this.close();
    this.loadTaxes();
    this.loadPrices();
  }

  protected remove(): void {
    const deletion = this.deletion();
    if (!deletion) return;
    const request = deletion.kind === 'tax' ? this.api.deleteTax(deletion.item.id) : this.api.deletePrice(deletion.item.id);
    const fallback = deletion.kind === 'tax' ? 'No se pudo eliminar la tarifa de IVA' : 'No se pudo eliminar el precio';
    request.subscribe({
      next: () => {
        const kind = deletion.kind;
        this.close();
        if (kind === 'tax') this.loadTaxes();
        else this.loadPrices();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, fallback));
      },
    });
  }

  private loadTaxes(): void {
    this.api.taxes().subscribe({
      next: (taxes) => this.taxes.set(taxes),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las tarifas de IVA')),
    });
  }

  private loadPrices(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.prices({ priceList: this.priceList() }).subscribe({
      next: (prices) => {
        this.prices.set(prices);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los precios'));
      },
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PresentationsApi, PricesApi, ProductsApi, TaxesApi } from '../../products.api';
import { PRICE_LISTS, Presentation, Price, Product, Tax, formatMoney } from '../../products.model';
import { PriceFormModal } from './modals/price-form-modal';
import { TaxFormModal } from './modals/tax-form-modal';

type PricingModal = 'price-create' | 'price-edit' | 'price-delete' | 'tax-create' | 'tax-edit' | 'tax-delete' | null;

@Component({
  selector: 'app-pricing-page',
  imports: [PageHeader, Icon, PriceFormModal, TaxFormModal, ConfirmModal],
  templateUrl: './pricing-page.html',
})
export class PricingPage {
  private readonly pricesApi = inject(PricesApi);
  private readonly taxesApi = inject(TaxesApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly presentationsApi = inject(PresentationsApi);

  protected readonly priceLists = PRICE_LISTS;
  protected readonly formatMoney = formatMoney;

  protected readonly prices = signal<Price[]>([]);
  protected readonly taxes = signal<Tax[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly query = signal('');
  protected readonly priceList = signal('');
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<PricingModal>(null);
  protected readonly selectedPrice = signal<Price | null>(null);
  protected readonly selectedTax = signal<Tax | null>(null);

  private readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));
  private readonly taxById = computed(() => new Map(this.taxes().map((t) => [t.id, t])));
  private readonly presentationNames = computed(() => new Map(this.presentations().map((p) => [p.id, p.name])));

  private searchTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.reloadCatalogs();
    this.loadPrices();
  }

  protected productName(price: Price): string {
    return this.productById().get(price.product_id)?.name ?? '—';
  }

  protected presentationName(price: Price): string {
    return price.presentation_id === null ? 'Unidad suelta' : (this.presentationNames().get(price.presentation_id) ?? '—');
  }

  protected taxLabel(price: Price): string {
    const taxId = this.productById().get(price.product_id)?.tax_id;
    const tax = taxId == null ? undefined : this.taxById().get(taxId);
    if (!tax) return '—';
    return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
  }

  protected taxRate(tax: Tax): string {
    return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
  }

  protected margin(price: Price): string {
    return price.margin === null ? '—' : `${Number(price.margin)}%`;
  }

  protected openPrice(modal: PricingModal, price: Price | null = null): void {
    this.selectedPrice.set(price);
    this.selectedTax.set(null);
    this.modal.set(modal);
  }

  protected openTax(modal: PricingModal, tax: Tax | null = null): void {
    this.selectedTax.set(tax);
    this.selectedPrice.set(null);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedPrice.set(null);
    this.selectedTax.set(null);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.loadPrices(), 250);
  }

  protected onPriceList(event: Event): void {
    this.priceList.set((event.target as HTMLSelectElement).value);
    this.loadPrices();
  }

  protected priceSaved(): void {
    this.close();
    this.loadPrices();
  }

  protected taxSaved(): void {
    this.close();
    this.reloadCatalogs();
  }

  protected confirmDelete(): void {
    const price = this.selectedPrice();
    const tax = this.selectedTax();
    if (price) {
      this.pricesApi.delete(price.id).subscribe({
        next: () => {
          this.close();
          this.loadPrices();
        },
        error: (err: unknown) => this.fail(err, 'No se pudo eliminar el precio'),
      });
    } else if (tax) {
      this.taxesApi.delete(tax.id).subscribe({
        next: () => {
          this.close();
          this.reloadCatalogs();
        },
        error: (err: unknown) => this.fail(err, 'No se pudo eliminar la tarifa de IVA'),
      });
    }
  }

  private fail(err: unknown, fallback: string): void {
    this.close();
    this.error.set(httpErrorMessage(err, fallback));
  }

  private reloadCatalogs(): void {
    this.taxesApi.list().subscribe({
      next: (taxes) => this.taxes.set(taxes),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las tarifas de IVA')),
    });
    this.productsApi.list({ query: '', categoryId: null, isActive: null }).subscribe({
      next: (products) => this.products.set(products),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar los productos')),
    });
    this.presentationsApi.list().subscribe({
      next: (presentations) => this.presentations.set(presentations),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las presentaciones')),
    });
  }

  private loadPrices(): void {
    this.loading.set(true);
    this.error.set(null);
    this.pricesApi.list(this.query(), this.priceList()).subscribe({
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

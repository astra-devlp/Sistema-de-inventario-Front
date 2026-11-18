import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { InventoryApi } from '../../inventory.api';
import {
  InventorySummary,
  MovementPreset,
  MovementType,
  ProductOption,
  Stock,
  Warehouse,
  formatMoney,
  formatQuantity,
} from '../../inventory.model';
import { MovementFormModal } from '../movements/modals/movement-form-modal';
import { MinStockModal } from './modals/min-stock-modal';

type StockModal = 'movement' | 'minimum' | null;

@Component({
  selector: 'app-stock-page',
  imports: [PageHeader, Icon, MovementFormModal, MinStockModal],
  templateUrl: './stock-page.html',
})
export class StockPage {
  private readonly api = inject(InventoryApi);

  protected readonly stocks = signal<Stock[]>([]);
  protected readonly summary = signal<InventorySummary | null>(null);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly query = signal('');
  protected readonly warehouseId = signal<number | null>(null);
  protected readonly lowStock = signal(false);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<StockModal>(null);
  protected readonly selected = signal<Stock | null>(null);
  protected readonly preset = signal<MovementPreset | null>(null);

  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;

  constructor() {
    this.api.warehouses().subscribe({ next: (warehouses) => this.warehouses.set(warehouses) });
    this.api.products().subscribe({ next: (products) => this.products.set(products) });
    this.load();
  }

  protected openMovement(stock: Stock | null = null, type: MovementType = 'entrada'): void {
    this.preset.set(stock ? { movement_type: type, product_id: stock.product_id, warehouse_id: stock.warehouse_id } : null);
    this.modal.set('movement');
  }

  protected openMinimum(stock: Stock): void {
    this.selected.set(stock);
    this.modal.set('minimum');
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
    this.preset.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.load();
  }

  protected onWarehouse(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.warehouseId.set(value ? Number(value) : null);
    this.load();
  }

  protected onLowStock(event: Event): void {
    this.lowStock.set((event.target as HTMLInputElement).checked);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.summary().subscribe({ next: (summary) => this.summary.set(summary) });
    this.api.stock({ warehouseId: this.warehouseId(), query: this.query(), lowStock: this.lowStock() }).subscribe({
      next: (stocks) => {
        this.stocks.set(stocks);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las existencias'));
      },
    });
  }
}

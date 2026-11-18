import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { InventoryApi } from '../../inventory.api';
import { Warehouse } from '../../inventory.model';
import { WarehouseFormModal } from './modals/warehouse-form-modal';

type WarehouseModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-warehouses-page',
  imports: [PageHeader, Icon, WarehouseFormModal, ConfirmModal],
  templateUrl: './warehouses-page.html',
})
export class WarehousesPage {
  private readonly api = inject(InventoryApi);

  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly query = signal('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<WarehouseModal>(null);
  protected readonly selected = signal<Warehouse | null>(null);

  constructor() {
    this.load();
  }

  protected open(modal: WarehouseModal, warehouse: Warehouse | null = null): void {
    this.selected.set(warehouse);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
    this.load();
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const warehouse = this.selected();
    if (!warehouse) return;
    this.api.deleteWarehouse(warehouse.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar la bodega'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.warehouses(this.query()).subscribe({
      next: (warehouses) => {
        this.warehouses.set(warehouses);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las bodegas'));
      },
    });
  }
}

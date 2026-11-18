import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { InventoryApi } from '../../inventory.api';
import {
  MOVEMENT_BADGE,
  MOVEMENT_ICON,
  MOVEMENT_TYPES,
  Movement,
  MovementType,
  ProductOption,
  Warehouse,
  formatMoney,
  formatQuantity,
  formatSignedQuantity,
  toNumber,
} from '../../inventory.model';
import { MovementFormModal } from './modals/movement-form-modal';

@Component({
  selector: 'app-movements-page',
  imports: [PageHeader, Icon, MovementFormModal, DatePipe],
  templateUrl: './movements-page.html',
})
export class MovementsPage {
  private readonly api = inject(InventoryApi);

  protected readonly movements = signal<Movement[]>([]);
  protected readonly warehouses = signal<Warehouse[]>([]);
  protected readonly products = signal<ProductOption[]>([]);
  protected readonly warehouseId = signal<number | null>(null);
  protected readonly movementType = signal<MovementType | ''>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly formOpen = signal(false);

  protected readonly types = MOVEMENT_TYPES;
  protected readonly badge = MOVEMENT_BADGE;
  protected readonly icons = MOVEMENT_ICON;
  protected readonly formatMoney = formatMoney;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatSignedQuantity = formatSignedQuantity;
  protected readonly toNumber = toNumber;

  constructor() {
    this.api.warehouses().subscribe({ next: (warehouses) => this.warehouses.set(warehouses) });
    this.api.products().subscribe({ next: (products) => this.products.set(products) });
    this.load();
  }

  protected onWarehouse(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.warehouseId.set(value ? Number(value) : null);
    this.load();
  }

  protected onType(event: Event): void {
    this.movementType.set((event.target as HTMLSelectElement).value as MovementType | '');
    this.load();
  }

  protected saved(): void {
    this.formOpen.set(false);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.movements({ warehouseId: this.warehouseId(), movementType: this.movementType() }).subscribe({
      next: (movements) => {
        this.movements.set(movements);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar los movimientos'));
      },
    });
  }
}

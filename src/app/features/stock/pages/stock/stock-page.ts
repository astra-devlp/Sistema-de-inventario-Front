import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { forkJoin, of } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop } from '@core/money/money';
import { Location } from '@features/locations/location.model';
import { NO_LOCATION_MESSAGE } from '@features/locations/location-rules';
import { LocationsApi } from '@features/locations/locations.api';
import { ProductsApi } from '@features/products/products.api';
import { Product, UnitRef } from '@features/products/products.model';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { formatQuantity } from '../../quantity';
import { minimumFor } from '../../stock-rules';
import { MOVEMENT_LABELS, MovementType, StockAlert, StockLevel, StockMovement, StockValuation } from '../../stock.model';
import { StockApi } from '../../stock.api';
import { InitialStockPanel } from './initial-stock-panel';
import { MinimumModal } from './minimum-modal';
import { MovementKind, MovementModal } from './movement-modal';
import { TransferPanel } from './transfer-panel';

type Tab = 'saldos' | 'movimientos' | 'traslados' | 'inicial';

const PAGE_SIZE = 100;

@Component({
  selector: 'app-stock-page',
  imports: [DatePipe, PageHeader, Icon, MovementModal, InitialStockPanel, MinimumModal, TransferPanel],
  templateUrl: './stock-page.html',
})
export class StockPage {
  private readonly stockApi = inject(StockApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly productsApi = inject(ProductsApi);
  protected readonly auth = inject(AuthService);

  protected readonly noLocationMessage = NO_LOCATION_MESSAGE;
  protected readonly formatQuantity = formatQuantity;
  protected readonly formatCop = formatCop;
  protected readonly movementLabels = MOVEMENT_LABELS;
  protected readonly movementTypes = Object.keys(MOVEMENT_LABELS) as MovementType[];

  protected readonly tab = signal<Tab>('saldos');
  protected readonly locations = signal<Location[]>([]);
  protected readonly assigned = signal<number[]>([]);
  protected readonly products = signal<Product[]>([]);
  protected readonly units = signal<UnitRef[]>([]);
  protected readonly levels = signal<Map<number, string>>(new Map());
  /** Saldo, costo promedio y valor de cada producto en la sede elegida. */
  protected readonly levelInfo = signal<Map<number, StockLevel>>(new Map());
  /** Mínimos propios de la sede; sin uno, vale el `min_stock` del producto. */
  protected readonly minimums = signal<Map<number, string>>(new Map());
  /** Alertas que decide el back (`GET /stock/alerts`): stock menor o igual al mínimo que aplica. */
  protected readonly alerts = signal<StockAlert[]>([]);
  protected readonly valuation = signal<StockValuation | null>(null);
  protected readonly minimumFor = signal<Product | null>(null);
  protected readonly movements = signal<StockMovement[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly locationId = signal<number | null>(null);
  protected readonly query = signal('');
  protected readonly movementProduct = signal<number | null>(null);
  protected readonly movementType = signal<MovementType | ''>('');
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly modal = signal<{ kind: MovementKind; product: Product | null } | null>(null);

  protected readonly isAdmin = computed(() => this.auth.isCompanyAdmin());
  /** Cualquier usuario de la empresa registra entradas; mermas, ajustes e inventario inicial, solo el Administrador. */
  protected readonly canEnter = computed(() => this.auth.hasRole('Administrador', 'Supervisor', 'Usuario'));
  /** El Administrador elige entre todas las sedes; los demás, entre las que tienen asignadas. */
  protected readonly options = computed(() =>
    this.isAdmin() ? this.locations() : this.locations().filter((l) => this.assigned().includes(l.id)),
  );
  protected readonly location = computed(() => this.options().find((l) => l.id === this.locationId()) ?? null);
  /** Una sede inactiva se puede consultar, pero no recibe movimientos (409). */
  protected readonly canWriteHere = computed(() => this.location()?.is_active === true);
  protected readonly withoutLocation = computed(() => !this.loading() && this.options().length === 0);

  private readonly unitById = computed(() => new Map(this.units().map((u) => [u.id, u])));
  private readonly productById = computed(() => new Map(this.products().map((p) => [p.id, p])));

  protected readonly rows = computed(() => {
    const text = this.query().trim().toLowerCase();
    const levels = this.levels();
    return this.products()
      .filter((p) => !text || p.name.toLowerCase().includes(text) || p.sku.toLowerCase().includes(text))
      .map((product) => {
        const quantity = levels.get(product.id) ?? '0';
        const info = this.levelInfo().get(product.id);
        return {
          product,
          unit: this.unitById().get(product.unit_id),
          quantity,
          minimum: minimumFor(this.minimums().get(product.id), product.min_stock),
          averageCost: info?.average_cost ?? null,
          totalValue: info?.total_value ?? null,
          low: this.lowIds().has(product.id),
        };
      });
  });

  private readonly lowIds = computed(() => new Set(this.alerts().map((alert) => alert.product_id)));

  constructor() {
    const user = this.auth.user();
    forkJoin({
      locations: this.locationsApi.list(),
      mine: user ? this.locationsApi.userLocations(user.id) : of({ user_id: 0, location_ids: [] as number[] }),
      products: this.productsApi.list({ query: '', categoryId: null, isActive: null }),
      catalogs: this.productsApi.catalogs(),
    }).subscribe({
      next: ({ locations, mine, products, catalogs }) => {
        this.locations.set(locations);
        this.assigned.set(mine.location_ids);
        this.products.set(products);
        this.units.set(catalogs.units);
        const options = this.options();
        this.locationId.set((options.find((l) => l.is_default) ?? options[0])?.id ?? null);
        this.loading.set(false);
        this.reload();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el stock'));
      },
    });
  }

  protected productName(id: number): string {
    return this.productById().get(id)?.name ?? `Producto ${id}`;
  }

  protected unitLabel(product: Product): string {
    return this.unitById().get(product.unit_id)?.abbreviation ?? '';
  }

  protected setTab(tab: Tab): void {
    this.tab.set(tab);
    this.reload();
  }

  protected onLocation(event: Event): void {
    this.locationId.set(Number((event.target as HTMLSelectElement).value));
    this.reload();
  }

  protected onQuery(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onMovementProduct(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.movementProduct.set(value ? Number(value) : null);
    this.reload();
  }

  protected onMovementType(event: Event): void {
    this.movementType.set((event.target as HTMLSelectElement).value as MovementType | '');
    this.reload();
  }

  protected showHistory(product: Product): void {
    this.movementProduct.set(product.id);
    this.setTab('movimientos');
  }

  protected open(kind: MovementKind, product: Product | null): void {
    this.success.set(null);
    this.modal.set({ kind, product });
  }

  protected saved(message: string): void {
    this.modal.set(null);
    this.success.set(message);
    this.reload();
  }

  protected initialSaved(): void {
    this.success.set('Inventario inicial cargado.');
    this.setTab('saldos');
  }

  protected loadMore(): void {
    this.fetchMovements(this.movements().length);
  }

  protected reload(): void {
    const locationId = this.locationId();
    this.error.set(null);
    if (locationId === null) return;
    if (this.tab() === 'movimientos') {
      this.fetchMovements(0);
      return;
    }
    if (this.tab() === 'traslados') {
      this.fetchLevels(locationId);
      return;
    }
    this.fetchLevels(locationId);
    forkJoin({
      minimums: this.stockApi.minimums(locationId),
      alerts: this.stockApi.alerts(locationId),
      valuation: this.stockApi.valuation(locationId),
    }).subscribe({
      next: ({ minimums, alerts, valuation }) => {
        this.minimums.set(new Map(minimums.map((m) => [m.product_id, m.min_quantity])));
        this.alerts.set(alerts);
        this.valuation.set(valuation);
      },
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar los mínimos y el valor')),
    });
  }

  protected openMinimum(product: Product): void {
    this.success.set(null);
    this.minimumFor.set(product);
  }

  protected minimumSaved(message: string): void {
    this.minimumFor.set(null);
    this.success.set(message);
    this.reload();
  }

  protected transferSaved(message: string): void {
    this.success.set(message);
    this.fetchLevels(this.locationId()!);
  }

  protected currentMinimum(product: Product): string {
    return minimumFor(this.minimums().get(product.id), product.min_stock);
  }

  private fetchLevels(locationId: number): void {
    this.stockApi.levels(locationId).subscribe({
      next: (levels) => {
        this.levels.set(new Map(levels.map((l) => [l.product_id, l.quantity])));
        this.levelInfo.set(new Map(levels.map((l) => [l.product_id, l])));
      },
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar los saldos')),
    });
  }

  private fetchMovements(offset: number): void {
    this.stockApi
      .movements({
        locationId: this.locationId(),
        productId: this.movementProduct(),
        movementType: this.movementType(),
        limit: PAGE_SIZE,
        offset,
      })
      .subscribe({
        next: (page) => {
          this.movements.set(offset === 0 ? page : [...this.movements(), ...page]);
          this.hasMore.set(page.length === PAGE_SIZE);
        },
        error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudo cargar el historial')),
      });
  }
}

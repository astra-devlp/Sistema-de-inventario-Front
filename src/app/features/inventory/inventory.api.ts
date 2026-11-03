import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  InventorySummary,
  MinimumStockPayload,
  Movement,
  MovementPayload,
  MovementType,
  ProductOption,
  Stock,
  Transfer,
  TransferPayload,
  Warehouse,
  WarehousePayload,
} from './inventory.model';

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);

  // Bodegas

  warehouses(query = ''): Observable<Warehouse[]> {
    if (!query.trim()) {
      return this.http.get<Warehouse[]>(`${API_URL}/warehouses`);
    }
    const params = new HttpParams().set('q', query.trim());
    return this.http.get<Warehouse[]>(`${API_URL}/warehouses/search`, { params });
  }

  createWarehouse(payload: WarehousePayload): Observable<Warehouse> {
    return this.http.post<Warehouse>(`${API_URL}/warehouses`, payload);
  }

  updateWarehouse(id: number, payload: Partial<WarehousePayload>): Observable<Warehouse> {
    return this.http.patch<Warehouse>(`${API_URL}/warehouses/${id}`, payload);
  }

  deleteWarehouse(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/warehouses/${id}`);
  }

  // Existencias

  summary(): Observable<InventorySummary> {
    return this.http.get<InventorySummary>(`${API_URL}/inventory/summary`);
  }

  stock(filters: { warehouseId?: number | null; query?: string; lowStock?: boolean } = {}): Observable<Stock[]> {
    let params = new HttpParams();
    if (filters.warehouseId) params = params.set('warehouse_id', filters.warehouseId);
    if (filters.query?.trim()) params = params.set('q', filters.query.trim());
    if (filters.lowStock) params = params.set('low_stock', true);
    return this.http.get<Stock[]>(`${API_URL}/inventory/stock`, { params });
  }

  setMinimum(payload: MinimumStockPayload): Observable<Stock> {
    return this.http.put<Stock>(`${API_URL}/inventory/stock/minimum`, payload);
  }

  // Movimientos

  movements(
    filters: { warehouseId?: number | null; productId?: number | null; movementType?: MovementType | '' } = {},
  ): Observable<Movement[]> {
    let params = new HttpParams();
    if (filters.warehouseId) params = params.set('warehouse_id', filters.warehouseId);
    if (filters.productId) params = params.set('product_id', filters.productId);
    if (filters.movementType) params = params.set('movement_type', filters.movementType);
    return this.http.get<Movement[]>(`${API_URL}/inventory/movements`, { params });
  }

  registerMovement(payload: MovementPayload): Observable<Movement> {
    return this.http.post<Movement>(`${API_URL}/inventory/movements`, payload);
  }

  registerTransfer(payload: TransferPayload): Observable<Transfer> {
    return this.http.post<Transfer>(`${API_URL}/inventory/transfers`, payload);
  }

  products(): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`${API_URL}/products`);
  }
}

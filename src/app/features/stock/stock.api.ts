import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  AdjustmentPayload,
  EntryPayload,
  InitialStockPayload,
  LossPayload,
  MovementFilters,
  StockLevel,
  StockMovement,
} from './stock.model';

/** No hay PATCH ni DELETE: los movimientos son inmutables y un error se corrige con un ajuste. */
@Injectable({ providedIn: 'root' })
export class StockApi {
  private readonly http = inject(HttpClient);

  levels(locationId: number): Observable<StockLevel[]> {
    return this.http.get<StockLevel[]>(`${API_URL}/stock`, { params: new HttpParams().set('location_id', locationId) });
  }

  movements(filters: MovementFilters): Observable<StockMovement[]> {
    let params = new HttpParams().set('limit', filters.limit).set('offset', filters.offset);
    if (filters.locationId !== null) params = params.set('location_id', filters.locationId);
    if (filters.productId !== null) params = params.set('product_id', filters.productId);
    if (filters.movementType) params = params.set('movement_type', filters.movementType);
    return this.http.get<StockMovement[]>(`${API_URL}/stock/movements`, { params });
  }

  entry(payload: EntryPayload): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${API_URL}/stock/entries`, payload);
  }

  loss(payload: LossPayload): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${API_URL}/stock/losses`, payload);
  }

  adjustment(payload: AdjustmentPayload): Observable<StockMovement> {
    return this.http.post<StockMovement>(`${API_URL}/stock/adjustments`, payload);
  }

  initial(payload: InitialStockPayload): Observable<StockMovement[]> {
    return this.http.post<StockMovement[]>(`${API_URL}/stock/initial`, payload);
  }
}

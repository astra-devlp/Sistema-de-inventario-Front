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
  StockAlert,
  StockLevel,
  StockMinimum,
  StockMovement,
  StockTransfer,
  StockValuation,
  TransferPayload,
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

  alerts(locationId: number): Observable<StockAlert[]> {
    return this.http.get<StockAlert[]>(`${API_URL}/stock/alerts`, { params: new HttpParams().set('location_id', locationId) });
  }

  /** Mínimos propios de la sede. Viven bajo /locations porque /stock no admite PUT. */
  minimums(locationId: number): Observable<StockMinimum[]> {
    return this.http.get<StockMinimum[]>(`${API_URL}/locations/${locationId}/stock-minimums`);
  }

  setMinimum(locationId: number, productId: number, minQuantity: string): Observable<StockMinimum> {
    return this.http.put<StockMinimum>(`${API_URL}/locations/${locationId}/stock-minimums/${productId}`, {
      min_quantity: minQuantity,
    });
  }

  valuation(locationId: number): Observable<StockValuation> {
    return this.http.get<StockValuation>(`${API_URL}/stock/valuation`, { params: new HttpParams().set('location_id', locationId) });
  }

  transfers(locationId: number): Observable<StockTransfer[]> {
    return this.http.get<StockTransfer[]>(`${API_URL}/stock/transfers`, {
      params: new HttpParams().set('location_id', locationId).set('limit', 100),
    });
  }

  transfer(payload: TransferPayload): Observable<StockTransfer> {
    return this.http.post<StockTransfer>(`${API_URL}/stock/transfers`, payload);
  }
}

import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { Shift, ShiftClosePayload, ShiftFilters, ShiftOpenPayload } from './shift.model';

/** No hay PATCH ni DELETE: un turno se abre y se cierra una sola vez. */
@Injectable({ providedIn: 'root' })
export class ShiftApi {
  private readonly http = inject(HttpClient);

  /** El turno abierto del usuario. 404 = no tiene: es el estado normal antes de abrir, no un error. */
  current(): Observable<Shift> {
    return this.http.get<Shift>(`${API_URL}/cash-shifts/current`);
  }

  open(payload: ShiftOpenPayload): Observable<Shift> {
    return this.http.post<Shift>(`${API_URL}/cash-shifts`, payload);
  }

  /** Cierre a ciegas: se envía lo contado; la respuesta trae esperado, contado y diferencia. */
  close(id: number, payload: ShiftClosePayload): Observable<Shift> {
    return this.http.post<Shift>(`${API_URL}/cash-shifts/${id}/close`, payload);
  }

  list(filters: ShiftFilters): Observable<Shift[]> {
    let params = new HttpParams().set('limit', filters.limit).set('offset', filters.offset);
    if (filters.status) params = params.set('status', filters.status);
    return this.http.get<Shift[]>(`${API_URL}/cash-shifts`, { params });
  }

  get(id: number): Observable<Shift> {
    return this.http.get<Shift>(`${API_URL}/cash-shifts/${id}`);
  }
}

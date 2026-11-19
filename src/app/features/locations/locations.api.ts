import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  CashRegister,
  CashRegisterCreatePayload,
  CashRegisterUpdatePayload,
  Location,
  LocationCreatePayload,
  LocationUpdatePayload,
  UserLocations,
} from './location.model';

@Injectable({ providedIn: 'root' })
export class LocationsApi {
  private readonly http = inject(HttpClient);

  list(): Observable<Location[]> {
    return this.http.get<Location[]>(`${API_URL}/locations`);
  }

  create(payload: LocationCreatePayload): Observable<Location> {
    return this.http.post<Location>(`${API_URL}/locations`, payload);
  }

  update(id: number, payload: LocationUpdatePayload): Observable<Location> {
    return this.http.patch<Location>(`${API_URL}/locations/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/locations/${id}`);
  }

  /** Sedes en las que el usuario opera la caja. Quien no es Administrador solo consulta las propias. */
  userLocations(userId: number): Observable<UserLocations> {
    return this.http.get<UserLocations>(`${API_URL}/users/${userId}/locations`);
  }

  /** Reemplaza la lista completa: lo que no viene se le quita al usuario. */
  setUserLocations(userId: number, locationIds: number[]): Observable<UserLocations> {
    return this.http.put<UserLocations>(`${API_URL}/users/${userId}/locations`, { location_ids: locationIds });
  }
}

@Injectable({ providedIn: 'root' })
export class CashRegistersApi {
  private readonly http = inject(HttpClient);

  /** El Administrador ve todas; los demás, solo las de sus sedes asignadas. */
  list(): Observable<CashRegister[]> {
    return this.http.get<CashRegister[]>(`${API_URL}/cash-registers`);
  }

  create(payload: CashRegisterCreatePayload): Observable<CashRegister> {
    return this.http.post<CashRegister>(`${API_URL}/cash-registers`, payload);
  }

  update(id: number, payload: CashRegisterUpdatePayload): Observable<CashRegister> {
    return this.http.patch<CashRegister>(`${API_URL}/cash-registers/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/cash-registers/${id}`);
  }
}

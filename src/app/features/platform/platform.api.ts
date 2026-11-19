import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { CompanyCreateBody, CompanyPatchBody, PlanBody, PlatformCompany, Tax, TaxBody, Unit, UnitBody } from './platform.model';

/**
 * `/platform/*`: solo el administrador de plataforma. No tiene empresa, así que aquí no hay `/companies/me` ni
 * rutas de negocio.
 */
@Injectable({ providedIn: 'root' })
export class PlatformApi {
  private readonly http = inject(HttpClient);
  private readonly base = `${API_URL}/platform`;

  companies(): Observable<PlatformCompany[]> {
    return this.http.get<PlatformCompany[]>(`${this.base}/companies`);
  }

  createCompany(body: CompanyCreateBody): Observable<PlatformCompany> {
    return this.http.post<PlatformCompany>(`${this.base}/companies`, body);
  }

  updateCompany(id: number, body: CompanyPatchBody): Observable<PlatformCompany> {
    return this.http.patch<PlatformCompany>(`${this.base}/companies/${id}`, body);
  }

  setPlan(id: number, body: PlanBody): Observable<PlatformCompany> {
    return this.http.put<PlatformCompany>(`${this.base}/companies/${id}/plan`, body);
  }

  units(): Observable<Unit[]> {
    return this.http.get<Unit[]>(`${this.base}/units`);
  }

  createUnit(body: UnitBody): Observable<Unit> {
    return this.http.post<Unit>(`${this.base}/units`, body);
  }

  updateUnit(id: number, body: UnitBody): Observable<Unit> {
    return this.http.patch<Unit>(`${this.base}/units/${id}`, body);
  }

  deleteUnit(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/units/${id}`);
  }

  taxes(): Observable<Tax[]> {
    return this.http.get<Tax[]>(`${this.base}/taxes`);
  }

  createTax(body: TaxBody): Observable<Tax> {
    return this.http.post<Tax>(`${this.base}/taxes`, body);
  }

  updateTax(id: number, body: TaxBody): Observable<Tax> {
    return this.http.patch<Tax>(`${this.base}/taxes/${id}`, body);
  }

  deleteTax(id: number): Observable<void> {
    return this.http.delete<void>(`${this.base}/taxes/${id}`);
  }
}

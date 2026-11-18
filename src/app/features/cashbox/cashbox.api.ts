import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  CashShift,
  CashboxDashboard,
  CloseShiftPayload,
  OpenShiftPayload,
  RegisterSalePayload,
} from './cashbox.model';

@Injectable({ providedIn: 'root' })
export class CashboxApi {
  private readonly http = inject(HttpClient);

  dashboard(): Observable<CashboxDashboard> {
    return this.http.get<CashboxDashboard>(`${API_URL}/cashbox/dashboard`);
  }

  openShift(payload: OpenShiftPayload): Observable<CashShift> {
    return this.http.post<CashShift>(`${API_URL}/cashbox/shifts/open`, payload);
  }

  closeShift(payload: CloseShiftPayload): Observable<CashShift> {
    return this.http.post<CashShift>(`${API_URL}/cashbox/shifts/close`, payload);
  }

  registerSale(payload: RegisterSalePayload): Observable<unknown> {
    return this.http.post(`${API_URL}/cashbox/sales`, payload);
  }
}

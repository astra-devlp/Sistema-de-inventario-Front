import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { mapDailyReport } from './daily-report';
import { DailyReport } from './daily-report.model';

@Injectable({ providedIn: 'root' })
export class DailyReportApi {
  private readonly http = inject(HttpClient);

  /** Solo lectura. El Cajero recibe 403 y una sede ajena, 404: ninguno es motivo para cerrar la sesión. */
  daily(locationId: number, date: string): Observable<DailyReport> {
    const params = new HttpParams().set('location_id', locationId).set('date', date);
    return this.http.get<DailyReport>(`${API_URL}/cash-reports/daily`, { params }).pipe(map(mapDailyReport));
  }
}

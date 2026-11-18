import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { SKIP_SESSION_REDIRECT } from '@core/api/http-context';
import { Company, CompanyUpdatePayload } from './company.model';

@Injectable({ providedIn: 'root' })
export class CompanyService {
  private readonly http = inject(HttpClient);

  /** Responde aun con el plan vencido (junto con `/users/me`). `skipRedirect`: un 401 no manda al login. */
  me(skipRedirect = false): Observable<Company> {
    const context = new HttpContext().set(SKIP_SESSION_REDIRECT, skipRedirect);
    return this.http.get<Company>(`${API_URL}/companies/me`, { context });
  }

  /** Solo el Administrador. NIT y razón social no se envían: los cambia plataforma (422). */
  update(payload: CompanyUpdatePayload): Observable<Company> {
    return this.http.patch<Company>(`${API_URL}/companies/me`, payload);
  }
}

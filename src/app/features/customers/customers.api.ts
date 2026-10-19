import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { Customer, CustomerPayload, DocumentTypeOption } from './customers.model';

@Injectable({ providedIn: 'root' })
export class CustomersApi {
  private readonly http = inject(HttpClient);

  documentTypes(): Observable<DocumentTypeOption[]> {
    return this.http.get<DocumentTypeOption[]>(`${API_URL}/customers/document-types`);
  }

  list(query = '', documentType = ''): Observable<Customer[]> {
    const searching = query.trim() || documentType;
    if (!searching) {
      return this.http.get<Customer[]>(`${API_URL}/customers`);
    }
    let params = new HttpParams();
    if (query.trim()) params = params.set('q', query.trim());
    if (documentType) params = params.set('document_type', documentType);
    return this.http.get<Customer[]>(`${API_URL}/customers/search`, { params });
  }

  create(payload: CustomerPayload): Observable<Customer> {
    return this.http.post<Customer>(`${API_URL}/customers`, payload);
  }

  update(id: number, payload: CustomerPayload): Observable<Customer> {
    return this.http.patch<Customer>(`${API_URL}/customers/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/customers/${id}`);
  }
}

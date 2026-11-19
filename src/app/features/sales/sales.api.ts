import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { AuthorizationPayload, ReturnCreatePayload, ReturnCreated, SaleReturn } from './return.model';
import { LookupResponse, Sale, SaleCreatePayload, SaleCreated } from './sale.model';

@Injectable({ providedIn: 'root' })
export class SalesApi {
  private readonly http = inject(HttpClient);

  /** Código de barras, SKU o parte del nombre. El back recorta los espacios; `q` vacío es 422. */
  lookup(q: string): Observable<LookupResponse> {
    return this.http.get<LookupResponse>(`${API_URL}/pos/products/lookup`, { params: new HttpParams().set('q', q) });
  }

  /** 201: venta nueva. 200: la misma venta ya creada (reintento con la misma clave). */
  create(payload: SaleCreatePayload): Observable<SaleCreated> {
    return this.http
      .post<Sale>(`${API_URL}/sales`, payload, { observe: 'response' })
      .pipe(map((response) => ({ sale: response.body as Sale, replay: response.status === 200 })));
  }

  /** Para reimprimir: no distingue mayúsculas ni espacios. */
  byReceipt(code: string): Observable<Sale> {
    return this.http.get<Sale>(`${API_URL}/sales/by-receipt/${encodeURIComponent(code.trim())}`);
  }

  /** Anular: el motivo es obligatorio (5 a 500 caracteres). `authorization` solo si quien opera es Usuario o la API la pide. */
  void(saleId: number, reason: string, authorization?: AuthorizationPayload): Observable<Sale> {
    const body = authorization ? { reason, authorization } : { reason };
    return this.http.post<Sale>(`${API_URL}/sales/${saleId}/void`, body);
  }

  /** 201: devolución nueva. 200: la misma ya creada (reintento con la misma clave). */
  createReturn(saleId: number, payload: ReturnCreatePayload): Observable<ReturnCreated> {
    return this.http
      .post<SaleReturn>(`${API_URL}/sales/${saleId}/returns`, payload, { observe: 'response' })
      .pipe(map((response) => ({ saleReturn: response.body as SaleReturn, replay: response.status === 200 })));
  }

  returnsOf(saleId: number): Observable<SaleReturn[]> {
    return this.http.get<SaleReturn[]>(`${API_URL}/sales/${saleId}/returns`);
  }

  getReturn(id: number): Observable<SaleReturn> {
    return this.http.get<SaleReturn>(`${API_URL}/sale-returns/${id}`);
  }

  getSale(id: number): Observable<Sale> {
    return this.http.get<Sale>(`${API_URL}/sales/${id}`);
  }
}

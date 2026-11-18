import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin, shareReplay } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  CategoryRef,
  PresentationRef,
  Product,
  ProductCatalogs,
  ProductFilters,
  ProductPayload,
  ProductStats,
  TaxRef,
  UnitRef,
} from './products.model';

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private catalogs$?: Observable<ProductCatalogs>;

  list(filters: ProductFilters): Observable<Product[]> {
    const query = filters.query.trim();
    if (!query && filters.categoryId === null && filters.isActive === null) {
      return this.http.get<Product[]>(`${API_URL}/products`);
    }
    let params = new HttpParams();
    if (query) params = params.set('query', query);
    if (filters.categoryId !== null) params = params.set('category_id', filters.categoryId);
    if (filters.isActive !== null) params = params.set('is_active', filters.isActive);
    return this.http.get<Product[]>(`${API_URL}/products/search`, { params });
  }

  stats(): Observable<ProductStats> {
    return this.http.get<ProductStats>(`${API_URL}/products/stats`);
  }

  create(payload: ProductPayload): Observable<Product> {
    return this.http.post<Product>(`${API_URL}/products`, payload);
  }

  update(id: number, payload: ProductPayload): Observable<Product> {
    return this.http.patch<Product>(`${API_URL}/products/${id}`, payload);
  }

  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/products/${id}`);
  }

  /** Solo lectura: el CRUD de estos catálogos pertenece a otras pantallas. */
  catalogs(): Observable<ProductCatalogs> {
    if (!this.catalogs$) {
      this.catalogs$ = forkJoin({
        categories: this.http.get<CategoryRef[]>(`${API_URL}/categories`),
        units: this.http.get<UnitRef[]>(`${API_URL}/units`),
        presentations: this.http.get<PresentationRef[]>(`${API_URL}/presentations`),
        taxes: this.http.get<TaxRef[]>(`${API_URL}/taxes`),
      }).pipe(shareReplay({ bufferSize: 1, refCount: false }));
    }
    return this.catalogs$;
  }

  /** Invalidar tras crear/editar categorías, unidades, etc. */
  invalidateCatalogs(): void {
    this.catalogs$ = undefined;
  }
}

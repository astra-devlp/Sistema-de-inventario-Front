import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, forkJoin } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import {
  Barcode,
  BarcodePayload,
  Category,
  CategoryPayload,
  CategoryRef,
  Presentation,
  PresentationPayload,
  PresentationRef,
  Price,
  PricePayload,
  Product,
  ProductCatalogs,
  ProductFilters,
  ProductPayload,
  ProductStats,
  Tax,
  TaxPayload,
  TaxRef,
  Unit,
  UnitPayload,
  UnitRef,
} from './products.model';

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);

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
    return forkJoin({
      categories: this.http.get<CategoryRef[]>(`${API_URL}/categories`),
      units: this.http.get<UnitRef[]>(`${API_URL}/units`),
      presentations: this.http.get<PresentationRef[]>(`${API_URL}/presentations`),
      taxes: this.http.get<TaxRef[]>(`${API_URL}/taxes`),
    });
  }
}

/** Crea el CRUD común de un recurso REST de la API. */
function crud<T, P>(http: HttpClient, resource: string) {
  const base = `${API_URL}/${resource}`;
  return {
    list: (params?: Record<string, string | number>) =>
      params && Object.keys(params).length
        ? http.get<T[]>(`${base}/search`, { params: new HttpParams({ fromObject: params }) })
        : http.get<T[]>(base),
    create: (payload: P) => http.post<T>(base, payload),
    update: (id: number, payload: Partial<P>) => http.patch<T>(`${base}/${id}`, payload),
    delete: (id: number) => http.delete<void>(`${base}/${id}`),
  };
}

@Injectable({ providedIn: 'root' })
export class CategoriesApi {
  private readonly rest = crud<Category, CategoryPayload>(inject(HttpClient), 'categories');
  readonly list = (name: string, isActive: boolean | null) => {
    const params: Record<string, string | number> = {};
    if (name.trim()) params['name'] = name.trim();
    if (isActive !== null) params['is_active'] = String(isActive);
    return this.rest.list(params);
  };
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;
}

@Injectable({ providedIn: 'root' })
export class UnitsApi {
  private readonly rest = crud<Unit, UnitPayload>(inject(HttpClient), 'units');
  readonly list = () => this.rest.list();
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;
}

@Injectable({ providedIn: 'root' })
export class PresentationsApi {
  private readonly rest = crud<Presentation, PresentationPayload>(inject(HttpClient), 'presentations');
  readonly list = () => this.rest.list();
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;
}

@Injectable({ providedIn: 'root' })
export class TaxesApi {
  private readonly rest = crud<Tax, TaxPayload>(inject(HttpClient), 'taxes');
  readonly list = () => this.rest.list();
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;
}

@Injectable({ providedIn: 'root' })
export class PricesApi {
  private readonly rest = crud<Price, PricePayload>(inject(HttpClient), 'prices');
  readonly list = (query: string, priceList: string) => {
    const params: Record<string, string | number> = {};
    if (query.trim()) params['query'] = query.trim();
    if (priceList) params['price_list'] = priceList;
    return this.rest.list(params);
  };
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;
}

@Injectable({ providedIn: 'root' })
export class BarcodesApi {
  private readonly http = inject(HttpClient);
  private readonly rest = crud<Barcode, BarcodePayload>(this.http, 'barcodes');
  readonly list = (query: string, codeType: string) => {
    const params: Record<string, string | number> = {};
    if (query.trim()) params['query'] = query.trim();
    if (codeType) params['code_type'] = codeType;
    return this.rest.list(params);
  };
  readonly create = this.rest.create;
  readonly update = this.rest.update;
  readonly delete = this.rest.delete;

  generate(codeType: string): Observable<{ code_type: string; code: string }> {
    return this.http.post<{ code_type: string; code: string }>(`${API_URL}/barcodes/generate`, null, {
      params: { code_type: codeType },
    });
  }
}

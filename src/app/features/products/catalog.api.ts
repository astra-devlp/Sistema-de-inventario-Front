import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { API_URL } from '@core/api/api-url';
import { ProductsApi } from './products.api';
import {
  Barcode,
  BarcodePayload,
  BarcodeType,
  Category,
  CategoryPayload,
  Presentation,
  PresentationPayload,
  Price,
  PriceList,
  PricePayload,
  ProductOption,
  Tax,
  TaxPayload,
  Unit,
  UnitPayload,
} from './catalog.model';

/** CRUD de los catálogos del producto. Cada pantalla de Productos usa la parte que le toca. */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly productsApi = inject(ProductsApi);

  private bustProductCatalogCache<T>(): (source: Observable<T>) => Observable<T> {
    return tap(() => this.productsApi.invalidateCatalogs());
  }

  products(): Observable<ProductOption[]> {
    return this.http.get<ProductOption[]>(`${API_URL}/products`);
  }

  // Categorías

  categories(filters: { name?: string; isActive?: boolean | null } = {}): Observable<Category[]> {
    const name = filters.name?.trim() ?? '';
    const isActive = filters.isActive ?? null;
    if (!name && isActive === null) return this.http.get<Category[]>(`${API_URL}/categories`);
    let params = new HttpParams();
    if (name) params = params.set('name', name);
    if (isActive !== null) params = params.set('is_active', isActive);
    return this.http.get<Category[]>(`${API_URL}/categories/search`, { params });
  }

  createCategory(payload: CategoryPayload): Observable<Category> {
    return this.http.post<Category>(`${API_URL}/categories`, payload).pipe(this.bustProductCatalogCache());
  }

  updateCategory(id: number, payload: CategoryPayload): Observable<Category> {
    return this.http.patch<Category>(`${API_URL}/categories/${id}`, payload).pipe(this.bustProductCatalogCache());
  }

  deleteCategory(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/categories/${id}`).pipe(this.bustProductCatalogCache());
  }

  // Unidades y presentaciones

  units(): Observable<Unit[]> {
    return this.http.get<Unit[]>(`${API_URL}/units`);
  }

  createUnit(payload: UnitPayload): Observable<Unit> {
    return this.http.post<Unit>(`${API_URL}/units`, payload).pipe(this.bustProductCatalogCache());
  }

  updateUnit(id: number, payload: UnitPayload): Observable<Unit> {
    return this.http.patch<Unit>(`${API_URL}/units/${id}`, payload).pipe(this.bustProductCatalogCache());
  }

  deleteUnit(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/units/${id}`).pipe(this.bustProductCatalogCache());
  }

  presentations(): Observable<Presentation[]> {
    return this.http.get<Presentation[]>(`${API_URL}/presentations`);
  }

  createPresentation(payload: PresentationPayload): Observable<Presentation> {
    return this.http.post<Presentation>(`${API_URL}/presentations`, payload).pipe(this.bustProductCatalogCache());
  }

  updatePresentation(id: number, payload: PresentationPayload): Observable<Presentation> {
    return this.http
      .patch<Presentation>(`${API_URL}/presentations/${id}`, payload)
      .pipe(this.bustProductCatalogCache());
  }

  deletePresentation(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/presentations/${id}`).pipe(this.bustProductCatalogCache());
  }

  // IVA

  taxes(): Observable<Tax[]> {
    return this.http.get<Tax[]>(`${API_URL}/taxes`);
  }

  createTax(payload: TaxPayload): Observable<Tax> {
    return this.http.post<Tax>(`${API_URL}/taxes`, payload).pipe(this.bustProductCatalogCache());
  }

  updateTax(id: number, payload: TaxPayload): Observable<Tax> {
    return this.http.patch<Tax>(`${API_URL}/taxes/${id}`, payload).pipe(this.bustProductCatalogCache());
  }

  deleteTax(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/taxes/${id}`).pipe(this.bustProductCatalogCache());
  }

  // Códigos de barras

  barcodes(filters: { query?: string; codeType?: BarcodeType | '' } = {}): Observable<Barcode[]> {
    const query = filters.query?.trim() ?? '';
    if (!query && !filters.codeType) return this.http.get<Barcode[]>(`${API_URL}/barcodes`);
    let params = new HttpParams();
    if (query) params = params.set('query', query);
    if (filters.codeType) params = params.set('code_type', filters.codeType);
    return this.http.get<Barcode[]>(`${API_URL}/barcodes/search`, { params });
  }

  generateBarcode(codeType: BarcodeType): Observable<{ code_type: string; code: string }> {
    const params = new HttpParams().set('code_type', codeType);
    return this.http.post<{ code_type: string; code: string }>(`${API_URL}/barcodes/generate`, null, { params });
  }

  createBarcode(payload: BarcodePayload): Observable<Barcode> {
    return this.http.post<Barcode>(`${API_URL}/barcodes`, payload);
  }

  updateBarcode(id: number, payload: BarcodePayload): Observable<Barcode> {
    return this.http.patch<Barcode>(`${API_URL}/barcodes/${id}`, payload);
  }

  deleteBarcode(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/barcodes/${id}`);
  }

  // Listas de precios

  prices(filters: { priceList?: PriceList | '' } = {}): Observable<Price[]> {
    if (!filters.priceList) return this.http.get<Price[]>(`${API_URL}/prices`);
    const params = new HttpParams().set('price_list', filters.priceList);
    return this.http.get<Price[]>(`${API_URL}/prices/search`, { params });
  }

  createPrice(payload: PricePayload): Observable<Price> {
    return this.http.post<Price>(`${API_URL}/prices`, payload);
  }

  updatePrice(id: number, payload: PricePayload): Observable<Price> {
    return this.http.patch<Price>(`${API_URL}/prices/${id}`, payload);
  }

  deletePrice(id: number): Observable<void> {
    return this.http.delete<void>(`${API_URL}/prices/${id}`);
  }
}

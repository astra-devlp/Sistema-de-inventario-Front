import type { UnitType } from './catalog.model';

export interface Product {
  id: number;
  name: string;
  category_id: number;
  brand: string | null;
  description: string | null;
  sku: string;
  barcode: string | null;
  unit_id: number;
  presentation_id: number | null;
  cost: number | string | null;
  sale_price: number | string;
  tax_id: number | null;
  price_with_tax: number | string;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductPayload {
  name: string;
  category_id: number;
  sku: string;
  unit_id: number;
  sale_price: number;
  brand: string | null;
  description: string | null;
  barcode: string | null;
  presentation_id: number | null;
  cost: number | null;
  tax_id: number | null;
  min_stock: number;
  is_active: boolean;
}

export interface ProductStats {
  total: number;
  active: number;
  inactive: number;
  categories: number;
}

export interface ProductFilters {
  query: string;
  categoryId: number | null;
  isActive: boolean | null;
}

/** Catálogos de solo lectura que el producto referencia por id. */
export interface CategoryRef {
  id: number;
  name: string;
  is_active: boolean;
}

export interface UnitRef {
  id: number;
  name: string;
  abbreviation: string;
  unit_type: UnitType;
}

export interface PresentationRef {
  id: number;
  name: string;
}

export interface TaxRef {
  id: number;
  name: string;
  rate: number | string;
  is_exempt: boolean;
  is_default: boolean;
}

export interface ProductCatalogs {
  categories: CategoryRef[];
  units: UnitRef[];
  presentations: PresentationRef[];
  taxes: TaxRef[];
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(value));
}

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

/** Entidades completas de los catálogos, tal como las devuelve la API. */
export interface Category extends CategoryRef {
  code: string | null;
  parent_id: number | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CategoryPayload {
  name: string;
  code: string | null;
  parent_id: number | null;
  description: string | null;
  is_active: boolean;
}

export const UNIT_TYPES = ['Cantidad', 'Peso', 'Volumen', 'Longitud'] as const;

export interface Unit extends UnitRef {
  unit_type: string;
}

export interface UnitPayload {
  name: string;
  abbreviation: string;
  unit_type: string;
}

export const PACKAGINGS = ['Caja', 'Paquete', 'Bulto', 'Docena', 'Pallet'] as const;

export interface Presentation extends PresentationRef {
  packaging: string;
  quantity: number;
  unit_id: number;
}

export interface PresentationPayload {
  name: string;
  packaging: string;
  quantity: number;
  unit_id: number;
}

export interface Tax extends TaxRef {
  status: string;
}

export interface TaxPayload {
  name: string;
  rate: number;
  is_exempt: boolean;
  is_default: boolean;
}

export const PRICE_LISTS = ['Detal', 'Mayorista', 'Distribuidor'] as const;

export interface Price {
  id: number;
  product_id: number;
  price_list: string;
  presentation_id: number | null;
  cost: number | string | null;
  margin: number | string | null;
  price_without_tax: number | string;
  price_with_tax: number | string;
}

export interface PricePayload {
  product_id: number;
  price_list: string;
  presentation_id: number | null;
  cost: number | null;
  margin: number | null;
  price_without_tax: number;
}

export const BARCODE_TYPES = ['EAN-13', 'EAN-8', 'UPC-A', 'Code 128', 'QR'] as const;

export interface Barcode {
  id: number;
  product_id: number;
  sku: string;
  code_type: string;
  code: string | null;
  presentation_id: number | null;
}

export interface BarcodePayload {
  product_id: number;
  sku: string;
  code_type: string;
  code: string | null;
  presentation_id: number | null;
}

export function formatMoney(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(value));
}

/** Catálogos que usa el producto: categorías, unidades, presentaciones, IVA, códigos y listas de precios. */

export type Money = number | string;

export interface Category {
  id: number;
  name: string;
  code: string | null;
  parent_id: number | null;
  description: string | null;
  is_active: boolean;
}

export interface CategoryPayload {
  name: string;
  code: string | null;
  parent_id: number | null;
  description: string | null;
  is_active: boolean;
}

export const UNIT_TYPES = ['Cantidad', 'Peso', 'Volumen', 'Longitud'] as const;
export type UnitType = (typeof UNIT_TYPES)[number];

export interface Unit {
  id: number;
  name: string;
  abbreviation: string;
  unit_type: UnitType;
}

export interface UnitPayload {
  name: string;
  abbreviation: string;
  unit_type: UnitType;
}

export const PACKAGINGS = ['Caja', 'Paquete', 'Bulto', 'Docena', 'Pallet'] as const;
export type Packaging = (typeof PACKAGINGS)[number];

export interface Presentation {
  id: number;
  name: string;
  packaging: Packaging;
  quantity: number;
  unit_id: number;
}

export interface PresentationPayload {
  name: string;
  packaging: Packaging;
  quantity: number;
  unit_id: number;
}

export interface Tax {
  id: number;
  name: string;
  rate: Money;
  is_exempt: boolean;
  is_default: boolean;
  status: string;
}

export interface TaxPayload {
  name: string;
  rate: number;
  is_exempt: boolean;
  is_default: boolean;
}

export const BARCODE_TYPES = ['EAN-13', 'EAN-8', 'UPC-A', 'Code 128', 'QR'] as const;
export type BarcodeType = (typeof BARCODE_TYPES)[number];

export interface Barcode {
  id: number;
  product_id: number;
  sku: string;
  code_type: BarcodeType;
  code: string | null;
  presentation_id: number | null;
}

export interface BarcodePayload {
  product_id: number;
  sku: string;
  code_type: BarcodeType;
  code: string | null;
  presentation_id: number | null;
}

export const PRICE_LISTS = ['Detal', 'Mayorista', 'Distribuidor'] as const;
export type PriceList = (typeof PRICE_LISTS)[number];

export interface Price {
  id: number;
  product_id: number;
  price_list: PriceList;
  presentation_id: number | null;
  cost: Money | null;
  margin: Money | null;
  price_without_tax: Money;
  price_with_tax: Money;
}

export interface PricePayload {
  product_id: number;
  price_list: PriceList;
  presentation_id: number | null;
  cost: number | null;
  margin: number | null;
  price_without_tax: number;
}

/** Lo mínimo del producto que necesitan las pantallas de catálogo. */
export interface ProductOption {
  id: number;
  name: string;
  sku: string;
  category_id: number;
  tax_id: number | null;
  cost: Money | null;
  is_active: boolean;
}

/** Precio con IVA según la tarifa; la API guarda el valor definitivo. */
export function withTax(amount: number, tax: Tax | undefined): number {
  if (!tax || tax.is_exempt) return amount;
  return amount * (1 + Number(tax.rate) / 100);
}

export function taxLabel(tax: Tax | undefined): string {
  if (!tax) return 'Sin IVA';
  return tax.is_exempt ? 'Exento' : `${Number(tax.rate)}%`;
}

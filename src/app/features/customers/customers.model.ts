export interface DocumentTypeOption {
  code: string;
  label: string;
}

export interface Customer {
  id: number;
  name: string;
  document_type: string;
  document_type_label: string;
  document_number: string;
  check_digit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface CustomerPayload {
  name: string;
  document_type: string;
  document_number: string;
  check_digit: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export const NIT_CODE = '31';

/** Catálogo DIAN. La API lo confirma al cargar la pantalla. */
export const DOCUMENT_TYPES: DocumentTypeOption[] = [
  { code: '13', label: 'Cédula de ciudadanía' },
  { code: '31', label: 'NIT' },
  { code: '22', label: 'Cédula de extranjería' },
  { code: '41', label: 'Pasaporte' },
  { code: '12', label: 'Tarjeta de identidad' },
  { code: '11', label: 'Registro civil' },
  { code: '21', label: 'Tarjeta de extranjería' },
  { code: '42', label: 'Documento de identificación extranjero' },
  { code: '47', label: 'PEP' },
  { code: '48', label: 'Permiso por protección temporal' },
  { code: '50', label: 'NIT de otro país' },
  { code: '91', label: 'NUIP' },
];

/** Los tipos que más se usan en un negocio, en el orden en que se muestran. */
const COMMON_DOCUMENT_CODES = ['13', '31', '22', '48', '41'];

export interface DocumentTypeGroups {
  common: DocumentTypeOption[];
  others: DocumentTypeOption[];
}

/** Separa los tipos comunes (en su orden) del resto (por código), sin descartar ninguno. */
export function groupDocumentTypes(types: DocumentTypeOption[]): DocumentTypeGroups {
  const common = COMMON_DOCUMENT_CODES.map((code) => types.find((type) => type.code === code)).filter(
    (type): type is DocumentTypeOption => !!type,
  );
  const others = types
    .filter((type) => !COMMON_DOCUMENT_CODES.includes(type.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  return { common, others };
}

export function formatDocument(customer: Pick<Customer, 'document_number' | 'check_digit'>): string {
  return customer.check_digit ? `${customer.document_number}-${customer.check_digit}` : customer.document_number;
}

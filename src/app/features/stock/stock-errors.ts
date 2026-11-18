import { apiRowErrors, httpErrorMessage, isConflict } from '@core/api/api-error';
import { formatQuantity } from './quantity';

/** Errores del inventario inicial por fila: `index` de la API empieza en 0 y es el de la fila enviada. */
export function initialRowErrors(error: unknown): Map<number, string> {
  const rows = new Map<number, string>();
  for (const row of apiRowErrors(error)) {
    if (Number.isInteger(row.index) && row.reason && !rows.has(row.index)) rows.set(row.index, row.reason);
  }
  return rows;
}

/** Faltantes de un 409 de stock insuficiente: todos los renglones, no solo el primero. */
export function shortageLines(error: unknown, nameOf: (productId: number | undefined) => string): string[] {
  if (!isConflict(error)) return [];
  return apiRowErrors(error)
    .filter((row) => row.code === 'stock_insuficiente')
    .map((row) => {
      const name = nameOf(row.productId);
      return row.requested !== undefined && row.available !== undefined
        ? `${name}: se piden ${formatQuantity(row.requested)} y hay ${formatQuantity(row.available)}`
        : `${name}: ${row.reason}`;
    });
}

/** Mensaje de un 409 o 422 de stock: la lista de faltantes si la hay; si no, el motivo de la API. */
export function stockErrorMessage(
  error: unknown,
  fallback: string,
  nameOf: (productId: number | undefined) => string = (id) => (id === undefined ? 'Producto' : `Producto ${id}`),
): string[] {
  const shortages = shortageLines(error, nameOf);
  return shortages.length ? shortages : [httpErrorMessage(error, fallback)];
}

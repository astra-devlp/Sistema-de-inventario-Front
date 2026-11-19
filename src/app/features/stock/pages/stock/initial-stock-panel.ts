import { Component, computed, inject, input, output, signal } from '@angular/core';
import { Product, UnitRef } from '@features/products/products.model';
import { Icon } from '@shared/ui/icon/icon';
import { parseQuantity } from '../../quantity';
import { StockApi } from '../../stock.api';
import { httpErrorMessage } from '@core/auth/auth.service';
import { initialRowErrors } from '../../stock-errors';

interface Row {
  productId: number | null;
  quantity: string;
}

/**
 * Inventario inicial por lote (`POST /stock/initial`), todo o nada. Los errores se muestran junto a cada fila: el
 * índice de la API empieza en 0 y coincide con la posición de la fila enviada, así que no se reordenan ni se quitan
 * filas entre el envío y la respuesta.
 */
@Component({
  selector: 'app-initial-stock-panel',
  imports: [Icon],
  templateUrl: './initial-stock-panel.html',
})
export class InitialStockPanel {
  private readonly api = inject(StockApi);

  readonly locationId = input.required<number>();
  readonly canWrite = input(true);
  readonly products = input<Product[]>([]);
  readonly units = input<UnitRef[]>([]);
  readonly levels = input<Map<number, string>>(new Map());
  readonly saved = output<void>();

  protected readonly rows = signal<Row[]>([{ productId: null, quantity: '' }]);
  protected readonly rowErrors = signal<Map<number, string>>(new Map());
  protected readonly reason = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Productos que todavía no tienen saldo en la sede: los candidatos a un inventario inicial. */
  protected readonly withoutStock = computed(() => this.products().filter((p) => !this.levels().has(p.id)));

  protected addRow(): void {
    this.rows.update((rows) => [...rows, { productId: null, quantity: '' }]);
  }

  protected addWithoutStock(): void {
    const used = new Set(this.rows().map((r) => r.productId));
    const added = this.withoutStock()
      .filter((p) => !used.has(p.id))
      .map((p): Row => ({ productId: p.id, quantity: '' }));
    this.rows.update((rows) => [...rows.filter((r) => r.productId !== null || r.quantity !== ''), ...added]);
    this.rowErrors.set(new Map());
  }

  protected removeRow(index: number): void {
    this.rows.update((rows) => rows.filter((_, i) => i !== index));
    this.rowErrors.set(new Map());
  }

  protected setProduct(index: number, event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.patch(index, { productId: value ? Number(value) : null });
  }

  protected setQuantity(index: number, event: Event): void {
    this.patch(index, { quantity: (event.target as HTMLInputElement).value });
  }

  protected onReason(event: Event): void {
    this.reason.set((event.target as HTMLInputElement).value);
  }

  protected unitOf(productId: number | null): UnitRef | undefined {
    const unitId = this.products().find((p) => p.id === productId)?.unit_id;
    return this.units().find((u) => u.id === unitId);
  }

  protected submit(): void {
    const rows = this.rows();
    const errors = this.validate(rows);
    this.rowErrors.set(errors);
    this.error.set(null);
    if (errors.size) {
      this.error.set('Corrige las filas marcadas: no se envió nada.');
      return;
    }

    this.submitting.set(true);
    this.api
      .initial({
        location_id: this.locationId(),
        reason: this.reason().trim() || null,
        items: rows.map((row) => ({ product_id: row.productId!, quantity: this.normalized(row) })),
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.rows.set([{ productId: null, quantity: '' }]);
          this.saved.emit();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          const fromApi = initialRowErrors(err);
          this.rowErrors.set(fromApi);
          this.error.set(
            fromApi.size
              ? 'El inventario inicial tiene filas con error: no se guardó nada. Corrige las marcadas y vuelve a enviar.'
              : httpErrorMessage(err, 'No se pudo cargar el inventario inicial'),
          );
        },
      });
  }

  private patch(index: number, changes: Partial<Row>): void {
    this.rows.update((rows) => rows.map((row, i) => (i === index ? { ...row, ...changes } : row)));
    this.rowErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(index);
      return next;
    });
  }

  private normalized(row: Row): string {
    const result = parseQuantity(row.quantity, this.unitOf(row.productId)?.unit_type);
    return result.ok ? result.value : row.quantity;
  }

  /** Mismas reglas que el back, para no enviar lo que ya se sabe inválido; la API sigue siendo el árbitro. */
  private validate(rows: Row[]): Map<number, string> {
    const errors = new Map<number, string>();
    const seen = new Map<number, number>();
    rows.forEach((row, index) => {
      if (row.productId === null) {
        errors.set(index, 'Elige un producto');
        return;
      }
      const first = seen.get(row.productId);
      if (first !== undefined) {
        errors.set(index, `Producto repetido en el lote (ya aparece en la fila ${first + 1})`);
        return;
      }
      seen.set(row.productId, index);
      const quantity = parseQuantity(row.quantity, this.unitOf(row.productId)?.unit_type);
      if (!quantity.ok) errors.set(index, quantity.error);
    });
    return errors;
  }
}

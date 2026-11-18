import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { catchError, of } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop } from '@core/money/money';
import { UsersApi } from '@features/users/users.api';
import { formatQuantity } from '../../../stock/quantity';
import { ReturnCreated, SaleReturn } from '../../return.model';
import { Sale } from '../../sale.model';
import { SalesApi } from '../../sales.api';
import { PAYMENT_LABELS } from './receipt';
import { ReturnModal } from './return-modal';
import { ReturnReceipt } from './return-receipt';
import { VoidModal } from './void-modal';
import { Modal } from '@shared/ui/modal/modal';

/**
 * Estado de una venta ya emitida (anulada, devuelta, devoluciones) y sus acciones: anular y devolver.
 * Los botones no se ocultan por suposiciones: la API es la que decide si se puede.
 */
@Component({
  selector: 'app-sale-detail',
  imports: [DatePipe, VoidModal, ReturnModal, ReturnReceipt, Modal],
  templateUrl: './sale-detail.html',
})
export class SaleDetail {
  private readonly api = inject(SalesApi);
  private readonly usersApi = inject(UsersApi);
  private readonly auth = inject(AuthService);

  readonly sale = input.required<Sale>();
  /** La venta cambió (anulada, o con una devolución nueva): la pantalla debe mostrar esta versión. */
  readonly changed = output<Sale>();

  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly labels = PAYMENT_LABELS;
  /** Colombia no tiene horario de verano: -05:00 todo el año. */
  protected readonly bogota = '-0500';

  protected readonly returns = signal<SaleReturn[]>([]);
  protected readonly returnsError = signal<string | null>(null);
  protected readonly voidOpen = signal(false);
  protected readonly returnOpen = signal(false);
  protected readonly viewing = signal<SaleReturn | null>(null);
  protected readonly viewingNote = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  private readonly names = signal<Map<number, string>>(new Map());

  protected readonly isVoided = computed(() => this.sale().status === 'anulada' || this.sale().voided_at !== null);

  constructor() {
    effect(() => {
      const id = this.sale().id;
      this.loadReturns(id);
    });
    // Solo el Administrador puede listar usuarios; los demás ven «Usuario #id».
    if (this.auth.hasRole('Administrador')) {
      this.usersApi
        .list()
        .pipe(catchError(() => of([])))
        .subscribe((users) => this.names.set(new Map(users.map((u) => [u.id, u.name]))));
    }
  }

  private loadReturns(saleId: number): void {
    this.returnsError.set(null);
    this.api.returnsOf(saleId).subscribe({
      next: (list) => this.returns.set(list),
      error: (err) => {
        this.returns.set([]);
        this.returnsError.set(httpErrorMessage(err, 'No se pudieron cargar las devoluciones'));
      },
    });
  }

  protected who(id: number | null): string {
    if (id === null) return '—';
    return this.names().get(id) ?? `Usuario #${id}`;
  }

  protected openReturn(id: number): void {
    const known = this.returns().find((r) => r.id === id);
    this.viewingNote.set(null);
    if (known) {
      this.viewing.set(known);
      return;
    }
    this.api.getReturn(id).subscribe({
      next: (saleReturn) => this.viewing.set(saleReturn),
      error: (err) => this.notice.set(httpErrorMessage(err, 'No se pudo abrir la devolución')),
    });
  }

  protected onVoided(sale: Sale): void {
    this.voidOpen.set(false);
    this.notice.set('Venta anulada.');
    this.changed.emit(sale);
  }

  /** El servidor dice que la venta ya cambió (p. ej. ya estaba anulada): se vuelve a leer. */
  protected refresh(): void {
    this.api.getSale(this.sale().id).subscribe({
      next: (sale) => this.changed.emit(sale),
      error: () => undefined,
    });
  }

  protected onReturned(created: ReturnCreated): void {
    this.returnOpen.set(false);
    this.viewing.set(created.saleReturn);
    this.viewingNote.set(created.replay ? 'Esta devolución ya estaba registrada: es el mismo comprobante, no se devolvió otra vez.' : null);
    this.notice.set(null);
    this.loadReturns(this.sale().id);
    this.refresh();
  }

  protected print(): void {
    window.print();
  }
}

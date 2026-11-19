import { Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop } from '@core/money/money';
import { ProductsApi } from '@features/products/products.api';
import { ShiftApi } from '@features/cash-shift/shift.api';
import { Shift } from '@features/cash-shift/shift.model';
import { isNoCurrentShift } from '@features/cash-shift/shift-rules';
import { formatQuantity } from '../../../stock/quantity';
import { shortageLines } from '../../../stock/stock-errors';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CartLine, addProduct, cartPreviewTotal, decideLookup, removeLine, setLineQuantity } from '../../cart';
import { IdempotencyKeys } from '../../idempotency';
import { PendingCharge, clearPendingCharge, isDefinitiveError, loadPendingCharge, pendingPayload, savePendingCharge } from '../../pending-charge';
import { lineTotal } from '../../sale-math';
import { saleErrorKind, saleErrorMessage, saleRowErrors } from '../../sale-errors';
import { PosProduct, Sale } from '../../sale.model';
import { SalesApi } from '../../sales.api';
import { ChargeModal, ChargeRequest } from './charge-modal';
import { Receipt } from './receipt';
import { SaleDetail } from './sale-detail';

type UnitTypes = Map<number, 'Cantidad' | 'Peso' | 'Volumen' | 'Longitud'>;

@Component({
  selector: 'app-sale-page',
  imports: [DatePipe, FormsModule, PageHeader, ChargeModal, Receipt, ConfirmModal, SaleDetail],
  templateUrl: './sale-page.html',
})
export class SalePage {
  private readonly api = inject(SalesApi);
  private readonly shiftApi = inject(ShiftApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly keys = new IdempotencyKeys();
  private readonly searchInput = viewChild<ElementRef<HTMLInputElement>>('searchBox');

  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly lineTotal = lineTotal;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly shift = signal<Shift | null>(null);
  private readonly unitTypes = signal<UnitTypes>(new Map());

  protected readonly query = signal('');
  protected readonly looking = signal(false);
  protected readonly notice = signal<string | null>(null);
  protected readonly choices = signal<PosProduct[]>([]);
  protected readonly choicesMore = signal(false);

  protected readonly lines = signal<CartLine[]>([]);
  protected readonly qtyErrors = signal<Map<number, string>>(new Map());
  /** Errores del servidor por renglón: posición en el carrito (el índice de la API empieza en 0). */
  protected readonly rowErrors = signal<Map<number, string>>(new Map());
  protected readonly shortages = signal<string[]>([]);

  protected readonly chargeOpen = signal(false);
  protected readonly charging = signal(false);
  protected readonly chargeError = signal<string | null>(null);

  /** Cobro enviado sin respuesta definitiva (red caída o 5xx): puede o no haberse cobrado. */
  protected readonly pending = signal<PendingCharge | null>(null);
  protected readonly discardOpen = signal(false);

  protected readonly receipt = signal<Sale | null>(null);
  protected readonly receiptNote = signal<string | null>(null);
  protected readonly receiptQuery = signal('');
  protected readonly receiptBusy = signal(false);
  protected readonly receiptError = signal<string | null>(null);

  protected readonly total = computed(() => cartPreviewTotal(this.lines()));
  protected readonly canCharge = computed(
    () => this.lines().length > 0 && this.qtyErrors().size === 0 && !this.charging() && this.shift() !== null && this.pending() === null,
  );

  constructor() {
    this.shiftApi.current().subscribe({
      next: (shift) => {
        this.shift.set(shift);
        this.productsApi.catalogs().subscribe({
          next: (catalogs) => {
            this.unitTypes.set(new Map(catalogs.units.map((unit) => [unit.id, unit.unit_type])));
            this.finishLoading();
          },
          error: () => this.finishLoading(),
        });
      },
      error: (err) => {
        // Sin turno abierto no se vende: se lleva a abrirlo.
        if (isNoCurrentShift(err)) {
          void this.router.navigate(['/turno']);
          return;
        }
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el turno'));
      },
    });
  }

  private finishLoading(): void {
    this.loading.set(false);
    const userId = this.auth.user()?.id;
    this.pending.set(userId === undefined ? null : loadPendingCharge(userId));
    this.focusSearch();
  }

  protected focusSearch(): void {
    setTimeout(() => this.searchInput()?.nativeElement.focus());
  }

  private unitTypeOf(product: PosProduct) {
    return this.unitTypes().get(product.unit_id) ?? null;
  }

  private resetServerErrors(): void {
    this.rowErrors.set(new Map());
    this.shortages.set([]);
  }

  // ---- búsqueda y escaneo ----

  /** Enter (el lector de códigos teclea el código y Enter): consulta y decide qué hacer según `match`. */
  protected search(): void {
    const q = this.query().trim();
    if (!q || this.looking()) return;
    this.looking.set(true);
    this.notice.set(null);
    this.choices.set([]);
    this.api.lookup(q).subscribe({
      next: (response) => {
        this.looking.set(false);
        this.query.set('');
        const decision = decideLookup(response);
        if (decision.action === 'add') this.add(decision.product);
        else if (decision.action === 'choose') {
          this.choices.set(decision.products);
          this.choicesMore.set(decision.hasMore);
        } else this.notice.set(`Sin resultados para «${q}»`);
        this.focusSearch();
      },
      error: (err) => {
        this.looking.set(false);
        // Los 409 (producto inactivo, código de presentación) traen su propio mensaje: se muestra tal cual.
        this.notice.set(httpErrorMessage(err, 'No se pudo buscar el producto'));
        this.query.set('');
        this.focusSearch();
      },
    });
  }

  protected choose(product: PosProduct): void {
    this.choices.set([]);
    this.add(product);
    this.focusSearch();
  }

  private add(product: PosProduct): void {
    const result = addProduct(this.lines(), product, this.unitTypeOf(product));
    if (!result.ok) {
      this.notice.set(result.error);
      return;
    }
    this.receipt.set(null);
    this.receiptNote.set(null);
    this.lines.set(result.lines);
    this.resetServerErrors();
  }

  // ---- carrito ----

  protected changeQuantity(line: CartLine, event: Event): void {
    const input = event.target as HTMLInputElement;
    const result = setLineQuantity(this.lines(), line.product.id, input.value);
    const errors = new Map(this.qtyErrors());
    if (result.ok) {
      errors.delete(line.product.id);
      this.lines.set(result.lines);
      this.resetServerErrors();
      input.value = result.lines.find((l) => l.product.id === line.product.id)?.quantity ?? input.value;
    } else {
      errors.set(line.product.id, result.error);
    }
    this.qtyErrors.set(errors);
  }

  protected remove(line: CartLine): void {
    this.lines.set(removeLine(this.lines(), line.product.id));
    const errors = new Map(this.qtyErrors());
    errors.delete(line.product.id);
    this.qtyErrors.set(errors);
    this.resetServerErrors();
    this.focusSearch();
  }

  protected clear(): void {
    this.lines.set([]);
    this.qtyErrors.set(new Map());
    this.resetServerErrors();
    this.focusSearch();
  }

  // ---- cobro ----

  protected openCharge(): void {
    if (!this.canCharge()) return;
    this.chargeError.set(null);
    this.chargeOpen.set(true);
  }

  protected closeCharge(): void {
    if (this.charging()) return;
    this.chargeOpen.set(false);
    this.focusSearch();
  }

  /**
   * Envía la venta. La clave de idempotencia es una por intento: se reutiliza solo si el cuerpo es idéntico (reintento
   * tras un fallo de red o un 5xx) y se renueva al confirmarse la venta.
   */
  protected charge(request: ChargeRequest): void {
    if (this.charging()) return;
    const body = {
      items: this.lines().map((line) => ({ product_id: line.product.id, quantity: line.quantity })),
      payments: request.payments,
      customer_id: request.customerId,
    };
    const payload = { idempotency_key: this.keys.keyFor(body), ...body };
    this.charging.set(true);
    this.chargeError.set(null);
    // Hasta tener una respuesta definitiva, el cobro queda guardado: si se recarga la página no se pierde la clave.
    const userId = this.auth.user()?.id;
    if (userId !== undefined) savePendingCharge(payload, userId);
    this.api.create(payload).subscribe({
      next: ({ sale, replay }) => {
        this.finishSale(sale, replay);
        this.chargeOpen.set(false);
      },
      error: (err) => {
        this.charging.set(false);
        if (isDefinitiveError(err)) {
          clearPendingCharge();
          this.handleChargeError(err);
          return;
        }
        // Sin respuesta definitiva: pudo cobrarse. Queda pendiente y bloquea otro cobro hasta resolverlo.
        this.chargeOpen.set(false);
        this.pending.set(userId === undefined ? null : loadPendingCharge(userId));
        this.notice.set(saleErrorMessage(err));
      },
    });
  }

  private finishSale(sale: Sale, replay: boolean): void {
    this.charging.set(false);
    clearPendingCharge();
    this.pending.set(null);
    this.keys.renew();
    this.receipt.set(sale);
    this.receiptNote.set(replay ? 'Esta venta ya estaba registrada: es el mismo comprobante, no se vendió otra vez.' : null);
    this.lines.set([]);
    this.qtyErrors.set(new Map());
    this.resetServerErrors();
    this.focusSearch();
  }

  /** Reintenta el cobro sin confirmar con la misma clave: si ya se había cobrado, el back devuelve esa venta (200). */
  protected retryPending(): void {
    const pending = this.pending();
    if (!pending || this.charging()) return;
    this.charging.set(true);
    this.notice.set(null);
    this.api.create(pendingPayload(pending)).subscribe({
      next: ({ sale, replay }) => this.finishSale(sale, replay),
      error: (err) => {
        this.charging.set(false);
        if (isDefinitiveError(err)) {
          clearPendingCharge();
          this.pending.set(null);
          this.keys.renew();
        }
        this.notice.set(saleErrorMessage(err, 'No se pudo confirmar el cobro'));
      },
    });
  }

  protected askDiscard(): void {
    this.discardOpen.set(true);
  }

  /** El usuario confirma que no se cobró: se descarta y se puede volver a vender. */
  protected discardPending(): void {
    clearPendingCharge();
    this.pending.set(null);
    this.keys.renew();
    this.discardOpen.set(false);
    this.focusSearch();
  }

  private handleChargeError(err: unknown): void {
    const kind = saleErrorKind(err);
    const names = new Map(this.lines().map((line) => [line.product.id, line.product.name]));
    const nameOf = (id: number | undefined) => (id === undefined ? 'Producto' : (names.get(id) ?? `Producto ${id}`));
    switch (kind) {
      case 'no_shift':
        void this.router.navigate(['/turno']);
        return;
      case 'stock':
      case 'rows':
        this.chargeOpen.set(false);
        this.rowErrors.set(saleRowErrors(err));
        this.shortages.set(kind === 'stock' ? shortageLines(err, nameOf) : []);
        this.notice.set(saleErrorMessage(err, 'Hay renglones con error: no se guardó nada'));
        this.focusSearch();
        return;
      case 'key_reused':
        // La clave quedó asociada a otra venta: la siguiente tentativa arranca con una nueva.
        this.keys.renew();
        this.chargeError.set(saleErrorMessage(err));
        return;
      default:
        this.chargeError.set(saleErrorMessage(err));
    }
  }

  // ---- comprobante ----

  protected print(): void {
    window.print();
  }

  protected newSale(): void {
    this.receipt.set(null);
    this.receiptNote.set(null);
    this.focusSearch();
  }

  protected findReceipt(): void {
    const code = this.receiptQuery().trim();
    if (!code || this.receiptBusy()) return;
    this.receiptBusy.set(true);
    this.receiptError.set(null);
    this.api.byReceipt(code).subscribe({
      next: (sale) => {
        this.receiptBusy.set(false);
        this.receipt.set(sale);
        this.receiptNote.set(null);
        this.receiptQuery.set('');
      },
      error: (err) => {
        this.receiptBusy.set(false);
        this.receiptError.set(httpErrorMessage(err, 'No se pudo consultar el comprobante'));
      },
    });
  }
}

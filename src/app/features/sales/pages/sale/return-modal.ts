import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop, moneyInputDisplay, moneyInputValue } from '@core/money/money';
import type { UnitType } from '@features/products/catalog.model';
import { ProductsApi } from '@features/products/products.api';
import { Modal } from '@shared/ui/modal/modal';
import { formatQuantity } from '../../../stock/quantity';
import { authErrorKind, authorizationPlan, lockSeconds } from '../../authorization';
import { IdempotencyKeys, ReturnBody, returnFingerprint } from '../../idempotency';
import {
  ReturnSelection,
  availableToReturn,
  checkRefunds,
  refundCaps,
  returnTotal,
  returnedByLine,
  suggestRefunds,
  validateReturnQuantity,
} from '../../return-math';
import { returnErrorKind, returnRowErrors } from '../../return-errors';
import { AuthorizationPayload, ReturnCreated, SaleReturn } from '../../return.model';
import { PaymentMethod } from '../../sale-math';
import { Sale, SaleLine } from '../../sale.model';
import { SalesApi } from '../../sales.api';
import { MAX_REASON, MIN_REASON } from './void-modal';
import { AuthDialog } from './auth-dialog';
import { PAYMENT_LABELS } from './receipt';

interface RowState {
  quantity: string;
  /** `null` hasta que el usuario elige: no hay valor por defecto. */
  restock: boolean | null;
}

type RestockChoice = '' | 'si' | 'no';

@Component({
  selector: 'app-return-modal',
  imports: [FormsModule, Modal, AuthDialog],
  templateUrl: './return-modal.html',
})
export class ReturnModal {
  private readonly api = inject(SalesApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly keys = new IdempotencyKeys<ReturnBody>(undefined, returnFingerprint);
  private sentLineIds: number[] = [];

  readonly open = input(false);
  readonly sale = input.required<Sale>();
  /** Devoluciones ya hechas de la venta: de ahí sale el valor exacto ya devuelto de cada renglón. */
  readonly returns = input<SaleReturn[]>([]);
  readonly closed = output<void>();
  readonly done = output<ReturnCreated>();

  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly available = availableToReturn;
  protected readonly labels = PAYMENT_LABELS;
  protected readonly maxReason = MAX_REASON;

  private readonly unitTypes = signal<Map<number, UnitType>>(new Map());
  protected readonly rows = signal<Map<number, RowState>>(new Map());
  protected readonly reason = signal('');
  protected readonly entered = signal<Partial<Record<PaymentMethod, string>>>({});
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly goToShift = signal(false);
  protected readonly rowServerErrors = signal<Map<number, string>>(new Map());

  protected readonly dialogOpen = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly lockedUntil = signal<number | null>(null);

  private readonly returned = computed(() => returnedByLine(this.returns()));
  protected readonly plan = computed(() => authorizationPlan(this.auth.user()?.role, 'return', this.sale().return_window_expired));
  protected readonly reasonLength = computed(() => this.reason().trim().length);
  protected readonly reasonValid = computed(() => this.reasonLength() >= MIN_REASON && this.reasonLength() <= MAX_REASON);

  /** Estado de cada renglón con cantidad escrita: su cantidad válida o su error. */
  protected readonly rowChecks = computed(() => {
    const out = new Map<number, { value: string | null; error: string | null }>();
    for (const line of this.sale().lines) {
      const row = this.rows().get(line.id);
      if (!row || row.quantity.trim() === '') continue;
      const checked = validateReturnQuantity(row.quantity, this.unitTypes().get(line.product_id) ?? null, line);
      if (!checked.ok) out.set(line.id, { value: null, error: checked.error });
      else if (row.restock === null) out.set(line.id, { value: checked.value, error: 'Elige si vuelve al stock o llegó dañado' });
      else out.set(line.id, { value: checked.value, error: null });
    }
    return out;
  });

  private readonly selection = computed<ReturnSelection[]>(() =>
    this.sale()
      .lines.filter((line) => this.rowChecks().get(line.id)?.value)
      .map((line) => ({ line, quantity: this.rowChecks().get(line.id)!.value as string })),
  );

  protected readonly total = computed(() => returnTotal(this.selection(), this.returned()));
  protected readonly caps = computed(() => refundCaps(this.sale().payments));
  protected readonly refundCheck = computed(() => checkRefunds(this.total(), this.sale().payments, this.entered()));
  protected readonly rowsOk = computed(
    () => this.selection().length > 0 && [...this.rowChecks().values()].every((check) => check.error === null),
  );
  protected readonly canSubmit = computed(() => this.rowsOk() && this.reasonValid() && this.refundCheck().ok && !this.busy());
  protected readonly who = computed(() => this.plan().who);

  constructor() {
    effect(() => {
      if (!this.open()) return;
      this.rows.set(new Map());
      this.reason.set('');
      this.entered.set({});
      this.error.set(null);
      this.goToShift.set(false);
      this.rowServerErrors.set(new Map());
      this.dialogOpen.set(false);
      this.dialogError.set(null);
      this.busy.set(false);
      this.loadUnitTypes();
    });
    // Al cambiar el valor de la devolución se propone de nuevo el reparto entre los medios con que se pagó.
    effect(() => {
      const total = this.total();
      const payments = this.sale().payments;
      const proposal: Partial<Record<PaymentMethod, string>> = {};
      for (const [method, amount] of suggestRefunds(total, payments)) proposal[method] = amount.replace(/\.00$/, '');
      this.entered.set(proposal);
    });
  }

  private loadUnitTypes(): void {
    forkJoin({
      products: this.productsApi.list({ query: '', categoryId: null, isActive: null }),
      catalogs: this.productsApi.catalogs(),
    }).subscribe({
      next: ({ products, catalogs }) => {
        const unitById = new Map(catalogs.units.map((unit) => [unit.id, unit.unit_type]));
        this.unitTypes.set(new Map(products.flatMap((p) => (unitById.has(p.unit_id) ? [[p.id, unitById.get(p.unit_id) as UnitType] as const] : []))));
      },
      // Sin catálogo no se valida por unidad en pantalla: la API sigue siendo la que decide.
      error: () => undefined,
    });
  }

  protected rowOf(line: SaleLine): RowState {
    return this.rows().get(line.id) ?? { quantity: '', restock: null };
  }

  protected setQuantity(line: SaleLine, quantity: string): void {
    const next = new Map(this.rows());
    next.set(line.id, { ...this.rowOf(line), quantity });
    this.rows.set(next);
    this.afterEdit();
  }

  protected setRestock(line: SaleLine, choice: RestockChoice): void {
    const next = new Map(this.rows());
    next.set(line.id, { ...this.rowOf(line), restock: choice === '' ? null : choice === 'si' });
    this.rows.set(next);
    this.afterEdit();
  }

  protected restockChoice(line: SaleLine): RestockChoice {
    const restock = this.rowOf(line).restock;
    return restock === null ? '' : restock ? 'si' : 'no';
  }

  /** Devolver todo lo que queda de un renglón. */
  protected fillAll(line: SaleLine): void {
    this.setQuantity(line, availableToReturn(line));
  }

  protected typeRefund(method: PaymentMethod, event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = moneyInputValue(input.value);
    input.value = moneyInputDisplay(clean);
    this.entered.set({ ...this.entered(), [method]: clean });
  }

  protected displayRefund(method: PaymentMethod): string {
    return moneyInputDisplay(this.entered()[method] ?? '');
  }

  private afterEdit(): void {
    this.error.set(null);
    this.rowServerErrors.set(new Map());
  }

  protected submit(): void {
    const check = this.refundCheck();
    if (!this.canSubmit() || !check.ok) return;
    this.error.set(null);
    if (this.plan().askUpFront) {
      this.dialogError.set(null);
      this.dialogOpen.set(true);
      return;
    }
    this.send(undefined);
  }

  protected authorize(credentials: AuthorizationPayload): void {
    this.send(credentials);
  }

  private send(credentials: AuthorizationPayload | undefined): void {
    const check = this.refundCheck();
    if (!check.ok) return;
    const selection = this.selection();
    const items = selection.map((s) => ({
      sale_line_id: s.line.id,
      quantity: s.quantity,
      restock: this.rows().get(s.line.id)?.restock === true,
    }));
    this.sentLineIds = selection.map((s) => s.line.id);
    const reason = this.reason().trim();
    const body: ReturnBody = { sale_id: this.sale().id, items, refunds: check.refunds, reason };
    const payload = { idempotency_key: this.keys.keyFor(body), items, refunds: check.refunds, reason, ...(credentials ? { authorization: credentials } : {}) };
    this.busy.set(true);
    this.api.createReturn(this.sale().id, payload).subscribe({
      next: (created) => {
        this.busy.set(false);
        this.keys.renew();
        this.dialogOpen.set(false);
        this.done.emit(created);
      },
      error: (err) => {
        this.busy.set(false);
        this.handleError(err);
      },
    });
  }

  private handleError(err: unknown): void {
    const kind = returnErrorKind(err);
    switch (kind) {
      case 'auth_required':
        this.dialogError.set(null);
        this.dialogOpen.set(true);
        return;
      case 'auth_invalid':
        // Mensaje único de la API, tal cual: no se adivina qué falló.
        this.dialogError.set(httpErrorMessage(err, 'Autorización no válida'));
        this.dialogOpen.set(true);
        return;
      case 'rate_limited':
        this.lockedUntil.set(Date.now() + lockSeconds(err) * 1000);
        this.dialogError.set(httpErrorMessage(err, 'Demasiados intentos de autorización'));
        this.dialogOpen.set(true);
        return;
      case 'no_shift':
        this.dialogOpen.set(false);
        this.closed.emit();
        void this.router.navigate(['/turno']);
        return;
      case 'other_location':
        this.dialogOpen.set(false);
        this.goToShift.set(true);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar la devolución'));
        return;
      case 'excess':
      case 'rows': {
        this.dialogOpen.set(false);
        const byIndex = returnRowErrors(err);
        const byLine = new Map<number, string>();
        for (const [index, message] of byIndex) {
          const lineId = this.sentLineIds[index];
          if (lineId !== undefined) byLine.set(lineId, message);
        }
        this.rowServerErrors.set(byLine);
        this.error.set(httpErrorMessage(err, 'Hay renglones con error: no se guardó nada'));
        return;
      }
      case 'key_reused':
        this.keys.renew();
        this.dialogOpen.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar la devolución'));
        return;
      default:
        // Reembolsos que no cuadran, venta anulada o fallo de red: se muestra y se puede reintentar (misma clave si nada cambió).
        this.dialogOpen.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar la devolución'));
    }
  }

  protected openShift(): void {
    this.closed.emit();
    void this.router.navigate(['/turno']);
  }

  protected dismiss(): void {
    if (this.busy() || this.dialogOpen()) return;
    this.closed.emit();
  }
}

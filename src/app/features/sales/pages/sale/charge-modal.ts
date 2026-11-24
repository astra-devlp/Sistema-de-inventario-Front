import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { formatCop, moneyInputDisplay, moneyInputValue, parseMoney } from '@core/money/money';
import { CustomersApi } from '@features/customers/customers.api';
import { Customer, DOCUMENT_TYPES, DocumentTypeOption, NIT_CODE } from '@features/customers/customers.model';
import { Modal } from '@shared/ui/modal/modal';
import { PaymentInput, PaymentMethod, remainingForCash, settlePayments } from '../../sale-math';
import { SalePaymentPayload } from '../../sale.model';

export interface ChargeRequest {
  payments: SalePaymentPayload[];
  customerId: number | null;
}

/** Billetes colombianos para el efectivo recibido. */
export const BILLS = ['5000', '10000', '20000', '50000', '100000'];

/**
 * Cobro: un monto por medio (efectivo, tarjeta, transferencia). Valida con la misma regla del back (`settlePayments`)
 * y emite los pagos ya limpios; la venta, la clave de idempotencia y los errores del servidor los maneja la pantalla.
 */
@Component({
  selector: 'app-charge-modal',
  imports: [FormsModule, Modal],
  templateUrl: './charge-modal.html',
})
export class ChargeModal {
  private readonly customersApi = inject(CustomersApi);

  readonly open = input(false);
  readonly total = input('0.00');
  readonly busy = input(false);
  readonly error = input<string | null>(null);
  readonly closed = output<void>();
  readonly confirm = output<ChargeRequest>();

  protected readonly formatCop = formatCop;
  protected readonly bills = BILLS;
  protected readonly nitCode = NIT_CODE;

  /** Valores limpios (`"50000"`), no los formateados. */
  protected readonly cash = signal('');
  protected readonly card = signal('');
  protected readonly transfer = signal('');
  /** Lo que queda fiado al cliente (venta a crédito). */
  protected readonly credit = signal('');
  protected readonly cardRef = signal('');
  protected readonly transferRef = signal('');

  protected readonly customer = signal<Customer | null>(null);
  protected readonly customerQuery = signal('');
  protected readonly customerResults = signal<Customer[]>([]);
  protected readonly customerError = signal<string | null>(null);
  protected readonly showNewCustomer = signal(false);
  protected readonly documentTypes = signal<DocumentTypeOption[]>(DOCUMENT_TYPES);
  protected readonly newName = signal('');
  protected readonly newType = signal('13');
  protected readonly newNumber = signal('');
  protected readonly newCheckDigit = signal('');
  protected readonly savingCustomer = signal(false);

  private readonly payments = computed<PaymentInput[]>(() => {
    const list: PaymentInput[] = [];
    for (const [method, raw] of [
      ['efectivo', this.cash()],
      ['tarjeta', this.card()],
      ['transferencia', this.transfer()],
      ['credito', this.credit()],
    ] as [PaymentMethod, string][]) {
      if (raw === '') continue;
      const parsed = parseMoney(raw);
      list.push({ method, amount: parsed.ok ? parsed.value : raw });
    }
    return list;
  });

  protected readonly entered = computed(() => this.payments().length > 0);
  protected readonly settle = computed(() =>
    settlePayments(this.total(), this.payments(), { hasCustomer: this.customer() !== null }),
  );
  protected readonly problem = computed(() => {
    const result = this.settle();
    return this.entered() && !result.ok ? result.error : null;
  });
  protected readonly change = computed(() => {
    const result = this.settle();
    return result.ok ? result.change : null;
  });
  protected readonly canConfirm = computed(() => this.settle().ok && !this.busy());

  constructor() {
    effect(() => {
      if (this.open()) this.reset();
    });
    this.customersApi.documentTypes().subscribe({
      next: (types) => types.length && this.documentTypes.set(types),
      error: () => undefined,
    });
  }

  private reset(): void {
    this.cash.set('');
    this.card.set('');
    this.transfer.set('');
    this.credit.set('');
    this.cardRef.set('');
    this.transferRef.set('');
    this.customer.set(null);
    this.customerQuery.set('');
    this.customerResults.set([]);
    this.customerError.set(null);
    this.showNewCustomer.set(false);
  }

  protected display(clean: string): string {
    return moneyInputDisplay(clean);
  }

  /** Formatea mientras se escribe (`50000` → `$ 50.000`) y guarda el valor limpio. */
  protected typeMoney(target: 'cash' | 'card' | 'transfer' | 'credit', event: Event): void {
    const input = event.target as HTMLInputElement;
    const clean = moneyInputValue(input.value);
    input.value = moneyInputDisplay(clean);
    this[target].set(clean);
  }

  protected setBill(bill: string): void {
    this.cash.set(bill);
  }

  /** «Exacto»: el efectivo cubre lo que falta tras tarjeta y transferencia. */
  protected exact(): void {
    const others = [this.card(), this.transfer(), this.credit()].map((v) => parseMoney(v)).flatMap((r) => (r.ok ? [r.value] : []));
    const remaining = remainingForCash(this.total(), others);
    this.cash.set(remaining === '0.00' ? '' : remaining.replace(/\.00$/, ''));
  }

  protected searchCustomers(): void {
    const q = this.customerQuery().trim();
    this.customerError.set(null);
    if (q.length < 2) {
      this.customerResults.set([]);
      return;
    }
    this.customersApi.list(q).subscribe({
      next: (list) => this.customerResults.set(list.slice(0, 8)),
      error: (err) => this.customerError.set(httpErrorMessage(err, 'No se pudo buscar el cliente')),
    });
  }

  protected pickCustomer(customer: Customer): void {
    this.customer.set(customer);
    this.customerResults.set([]);
    this.customerQuery.set('');
    this.showNewCustomer.set(false);
  }

  protected saveNewCustomer(): void {
    const name = this.newName().trim();
    const number = this.newNumber().trim();
    if (!name || !number) {
      this.customerError.set('Escribe el nombre y el número de documento');
      return;
    }
    const isNit = this.newType() === NIT_CODE;
    this.savingCustomer.set(true);
    this.customerError.set(null);
    this.customersApi
      .create({
        name,
        document_type: this.newType(),
        document_number: number,
        check_digit: isNit ? this.newCheckDigit().trim() || null : null,
        email: null,
        phone: null,
        address: null,
      })
      .subscribe({
        next: (created) => {
          this.savingCustomer.set(false);
          this.pickCustomer(created);
          this.newName.set('');
          this.newNumber.set('');
          this.newCheckDigit.set('');
        },
        error: (err) => {
          this.savingCustomer.set(false);
          this.customerError.set(httpErrorMessage(err, 'No se pudo crear el cliente'));
        },
      });
  }

  protected submit(): void {
    const result = this.settle();
    if (!result.ok || this.busy()) return;
    const payments: SalePaymentPayload[] = this.payments().map((payment) => {
      const reference =
        payment.method === 'tarjeta' ? this.cardRef().trim() : payment.method === 'transferencia' ? this.transferRef().trim() : '';
      return reference ? { method: payment.method, amount: payment.amount, reference } : { method: payment.method, amount: payment.amount };
    });
    this.confirm.emit({ payments, customerId: this.customer()?.id ?? null });
  }
}

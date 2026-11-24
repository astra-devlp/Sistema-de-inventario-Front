import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { httpErrorMessage } from '@core/auth/auth.service';
import { formatCop } from '@core/money/money';
import { IdempotencyKeys } from '@features/sales/idempotency';
import { Modal } from '@shared/ui/modal/modal';
import { CustomerAccount, CustomerPaymentBody, PaymentMethodForCredit } from '../../../customer-account.model';
import { checkPayment, paymentFingerprint } from '../../../customer-payment';
import { CustomersApi } from '../../../customers.api';
import { Customer } from '../../../customers.model';

const METHOD_LABELS: Record<PaymentMethodForCredit, string> = { efectivo: 'Efectivo', tarjeta: 'Tarjeta', transferencia: 'Transferencia' };

/** Saldo, ventas a crédito y abonos de un cliente. Registrar un abono exige turno abierto (lo valida el back). */
@Component({
  selector: 'app-account-modal',
  imports: [DatePipe, FormsModule, Modal],
  templateUrl: './account-modal.html',
})
export class AccountModal {
  private readonly api = inject(CustomersApi);
  private readonly keys = new IdempotencyKeys<{ id: number; body: CustomerPaymentBody }>(undefined, ({ id, body }) =>
    paymentFingerprint(id, body),
  );

  readonly customer = input<Customer | null>(null);
  readonly closed = output<void>();

  protected readonly formatCop = formatCop;
  protected readonly methodLabels = METHOD_LABELS;
  protected readonly methods = Object.keys(METHOD_LABELS) as PaymentMethodForCredit[];
  protected readonly account = signal<CustomerAccount | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly method = signal<PaymentMethodForCredit>('efectivo');
  protected readonly amount = signal('');
  protected readonly received = signal('');
  protected readonly note = signal('');

  constructor() {
    effect(() => {
      const customer = this.customer();
      this.account.set(null);
      this.error.set(null);
      this.success.set(null);
      this.amount.set('');
      this.received.set('');
      this.note.set('');
      this.keys.renew();
      if (customer) this.load(customer.id);
    });
  }

  protected pay(): void {
    const customer = this.customer();
    const account = this.account();
    if (!customer || !account || this.submitting()) return;
    const checked = checkPayment(this.method(), this.amount(), this.received(), account.balance, this.note());
    if (!checked.ok) {
      this.error.set(checked.error);
      return;
    }
    this.error.set(null);
    this.submitting.set(true);
    const key = this.keys.keyFor({ id: customer.id, body: checked.body });
    this.api.pay(customer.id, key, checked.body).subscribe({
      next: (payment) => {
        this.submitting.set(false);
        this.keys.renew();
        const change = payment.method === 'efectivo' && payment.change !== '0.00' ? ` Cambio: ${formatCop(payment.change)}.` : '';
        this.success.set(`Abono de ${formatCop(payment.amount)} registrado.${change}`);
        this.amount.set('');
        this.received.set('');
        this.note.set('');
        this.load(customer.id);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo registrar el abono'));
      },
    });
  }

  private load(customerId: number): void {
    this.api.account(customerId).subscribe({
      next: (account) => this.account.set(account),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudo cargar la cuenta del cliente')),
    });
  }
}

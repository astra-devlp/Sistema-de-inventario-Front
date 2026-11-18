import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { Modal } from '@shared/ui/modal/modal';
import { authErrorKind, authorizationPlan, lockSeconds, voidConflictKind } from '../../authorization';
import { AuthorizationPayload } from '../../return.model';
import { Sale } from '../../sale.model';
import { SalesApi } from '../../sales.api';
import { AuthDialog } from './auth-dialog';

export const MIN_REASON = 5;
export const MAX_REASON = 500;

/** Anular una venta: motivo de 5 a 500 caracteres y, si hace falta, la autorización de un supervisor. */
@Component({
  selector: 'app-void-modal',
  imports: [FormsModule, Modal, AuthDialog],
  templateUrl: './void-modal.html',
})
export class VoidModal {
  private readonly api = inject(SalesApi);
  private readonly auth = inject(AuthService);

  readonly open = input(false);
  readonly sale = input.required<Sale>();
  readonly closed = output<void>();
  /** La venta anulada, tal como la devuelve el servidor. */
  readonly voided = output<Sale>();
  /** El servidor dice que la venta ya no es la que se ve (p. ej. ya estaba anulada): hay que releerla. */
  readonly stale = output<void>();

  protected readonly maxReason = MAX_REASON;
  protected readonly reason = signal('');
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly dialogOpen = signal(false);
  protected readonly dialogError = signal<string | null>(null);
  protected readonly lockedUntil = signal<number | null>(null);

  protected readonly reasonLength = computed(() => this.reason().trim().length);
  protected readonly reasonValid = computed(() => this.reasonLength() >= MIN_REASON && this.reasonLength() <= MAX_REASON);
  private readonly plan = computed(() => authorizationPlan(this.auth.user()?.role, 'void', this.sale().return_window_expired));
  protected readonly who = computed(() => this.plan().who);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.reason.set('');
        this.error.set(null);
        this.dialogOpen.set(false);
        this.dialogError.set(null);
        this.busy.set(false);
      }
    });
  }

  protected confirm(): void {
    if (!this.reasonValid() || this.busy()) return;
    this.error.set(null);
    if (this.plan().askUpFront) {
      this.dialogError.set(null);
      this.dialogOpen.set(true);
      return;
    }
    this.send();
  }

  protected authorize(credentials: AuthorizationPayload): void {
    this.send(credentials);
  }

  private send(credentials?: AuthorizationPayload): void {
    this.busy.set(true);
    this.api.void(this.sale().id, this.reason().trim(), credentials).subscribe({
      next: (sale) => {
        this.busy.set(false);
        this.dialogOpen.set(false);
        this.voided.emit(sale);
      },
      error: (err) => {
        this.busy.set(false);
        const kind = authErrorKind(err);
        if (kind === 'required') {
          // El servidor pide la autorización de un supervisor: ahora sí se abre el diálogo.
          this.dialogError.set(null);
          this.dialogOpen.set(true);
        } else if (kind === 'invalid') {
          // Mensaje único de la API, tal cual: no se adivina si falló el correo, la clave, el rol o la sede.
          this.dialogError.set(httpErrorMessage(err, 'Autorización no válida'));
          this.dialogOpen.set(true);
        } else if (kind === 'rate_limited') {
          this.lockedUntil.set(Date.now() + lockSeconds(err) * 1000);
          this.dialogError.set(httpErrorMessage(err, 'Demasiados intentos de autorización'));
          this.dialogOpen.set(true);
        } else {
          this.dialogOpen.set(false);
          this.error.set(httpErrorMessage(err, 'No se pudo anular la venta'));
          if (voidConflictKind(err) === 'already_voided') this.stale.emit();
        }
      },
    });
  }

  protected dismiss(): void {
    if (this.busy() || this.dialogOpen()) return;
    this.closed.emit();
  }
}

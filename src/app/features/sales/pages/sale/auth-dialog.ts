import { Component, ElementRef, OnDestroy, computed, effect, input, output, signal, viewChild } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';
import { formatCountdown, remainingSeconds } from '../../authorization';
import { AuthorizationPayload } from '../../return.model';

/**
 * Diálogo de autorización: correo y contraseña de un Supervisor o Administrador, escritos en el momento.
 *
 * Las credenciales no pasan por ninguna señal, formulario ni almacenamiento: se leen del campo al enviar, se borran
 * del campo en ese mismo instante y solo viajan en el evento hacia quien arma la petición.
 */
@Component({
  selector: 'app-auth-dialog',
  imports: [Modal],
  templateUrl: './auth-dialog.html',
})
export class AuthDialog implements OnDestroy {
  readonly open = input(false);
  readonly who = input<'supervisor' | 'administrador'>('supervisor');
  readonly notice = input<string | null>(null);
  readonly error = input<string | null>(null);
  readonly busy = input(false);
  /** Marca de tiempo (ms) hasta la que el envío está bloqueado por un 429. */
  readonly lockedUntil = input<number | null>(null);
  readonly submitted = output<AuthorizationPayload>();
  readonly closed = output<void>();

  private readonly emailField = viewChild<ElementRef<HTMLInputElement>>('email');
  private readonly passwordField = viewChild<ElementRef<HTMLInputElement>>('password');

  private readonly now = signal(Date.now());
  private timer: ReturnType<typeof setInterval> | null = null;

  protected readonly remaining = computed(() => {
    const until = this.lockedUntil();
    return until === null ? 0 : remainingSeconds(until, this.now());
  });
  protected readonly locked = computed(() => this.remaining() > 0);
  protected readonly countdown = computed(() => formatCountdown(this.remaining()));
  protected readonly whoLabel = computed(() => (this.who() === 'administrador' ? 'un Administrador' : 'un Supervisor de la sede o un Administrador'));

  constructor() {
    effect(() => {
      const until = this.lockedUntil();
      this.stopTimer();
      if (until !== null && until > Date.now()) {
        this.now.set(Date.now());
        this.timer = setInterval(() => {
          this.now.set(Date.now());
          if (Date.now() >= until) this.stopTimer();
        }, 1000);
      }
    });
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private stopTimer(): void {
    if (this.timer !== null) clearInterval(this.timer);
    this.timer = null;
  }

  protected submit(): void {
    if (this.busy() || this.locked()) return;
    const email = this.emailField()?.nativeElement;
    const password = this.passwordField()?.nativeElement;
    if (!email || !password) return;
    const payload = { email: email.value.trim(), password: password.value };
    if (!payload.email || !payload.password) return;
    // Se borran al enviar: si la API los rechaza, hay que escribirlos de nuevo.
    email.value = '';
    password.value = '';
    this.submitted.emit(payload);
  }

  protected dismiss(): void {
    const email = this.emailField()?.nativeElement;
    const password = this.passwordField()?.nativeElement;
    if (email) email.value = '';
    if (password) password.value = '';
    this.closed.emit();
  }
}

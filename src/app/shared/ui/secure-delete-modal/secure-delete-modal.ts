import { Component, DestroyRef, effect, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, Subscription } from 'rxjs';
import { Modal } from '../modal/modal';

const WAIT_SECONDS = 3;

/**
 * Eliminación en dos pasos:
 * 1) Casilla + espera de 3 s.
 * 2) Escribir el correo a mano (sin pegar) y confirmar.
 */
@Component({
  selector: 'app-secure-delete-modal',
  imports: [Modal],
  templateUrl: './secure-delete-modal.html',
})
export class SecureDeleteModal {
  private readonly destroyRef = inject(DestroyRef);
  private timerSub: Subscription | null = null;

  readonly open = input(false);
  readonly email = input.required<string>();
  readonly title = input('Eliminar');
  readonly message = input('¿Deseas eliminar este registro?');
  readonly entityLabel = input('registro');
  readonly closed = output<void>();
  readonly confirmed = output<void>();

  protected readonly step = signal<1 | 2>(1);
  protected readonly acknowledged = signal(false);
  protected readonly remaining = signal(WAIT_SECONDS);
  protected readonly typedEmail = signal('');
  protected readonly submitting = signal(false);

  constructor() {
    effect((onCleanup) => {
      if (!this.open()) {
        this.stopTimer();
        this.reset();
        return;
      }
      this.reset();
      onCleanup(() => this.stopTimer());
    });
  }

  protected get waitDone(): boolean {
    return this.remaining() <= 0;
  }

  protected get canContinue(): boolean {
    return this.acknowledged() && this.waitDone;
  }

  protected get emailMatches(): boolean {
    return this.typedEmail().trim().toLowerCase() === this.email().trim().toLowerCase();
  }

  protected get canDelete(): boolean {
    return this.emailMatches && !this.submitting();
  }

  protected get countdownLabel(): string {
    return `${this.remaining()}`;
  }

  protected onAckChange(checked: boolean): void {
    this.acknowledged.set(checked);
    this.stopTimer();
    if (!checked) {
      this.remaining.set(WAIT_SECONDS);
      return;
    }
    this.remaining.set(WAIT_SECONDS);
    const startedAt = Date.now();
    this.timerSub = interval(100)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        const left = Math.max(0, WAIT_SECONDS - Math.floor((Date.now() - startedAt) / 1000));
        this.remaining.set(left);
        if (left <= 0) this.stopTimer();
      });
  }

  protected goToEmailStep(): void {
    if (!this.canContinue) return;
    this.stopTimer();
    this.step.set(2);
    this.typedEmail.set('');
  }

  protected blockPaste(event: Event): void {
    event.preventDefault();
  }

  protected blockDrop(event: Event): void {
    event.preventDefault();
  }

  protected confirmDelete(): void {
    if (!this.canDelete) return;
    this.submitting.set(true);
    this.confirmed.emit();
  }

  protected cancel(): void {
    this.stopTimer();
    this.reset();
    this.closed.emit();
  }

  private stopTimer(): void {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  private reset(): void {
    this.step.set(1);
    this.acknowledged.set(false);
    this.remaining.set(WAIT_SECONDS);
    this.typedEmail.set('');
    this.submitting.set(false);
  }
}

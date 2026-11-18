import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatMoney, formatMoneyInput, parseMoneyInput } from '@features/inventory/inventory.model';
import { CashboxApi } from './cashbox.api';
import { CashboxDashboard, CashShift } from './cashbox.model';

@Component({
  selector: 'app-cashbox-page',
  imports: [FormsModule],
  templateUrl: './cashbox-page.html',
  styleUrl: './cashbox-page.css',
})
export class CashboxPage implements OnInit {
  private readonly api = inject(CashboxApi);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly data = signal<CashboxDashboard | null>(null);

  protected readonly openingCashText = signal('');
  protected readonly countedCashText = signal('');

  /** Admin, Cliente y Usuario pueden operar; Admin además ve el historial de todos. */
  protected readonly canOperate = computed(() => {
    const role = this.auth.user()?.role;
    return (
      role === 'Administrador' ||
      role === 'Administrador de plataforma' ||
      role === 'Cliente' ||
      role === 'Usuario'
    );
  });

  protected readonly isPlatformAdmin = computed(() => this.auth.isAdmin());

  protected readonly shift = computed(() => this.data()?.shift ?? null);
  protected readonly isOpen = computed(() => this.shift()?.status === 'open');

  protected readonly expectedDiff = computed(() => {
    const dash = this.data();
    const counted = parseMoneyInput(this.countedCashText());
    if (!dash || counted == null || Number.isNaN(counted)) return null;
    return counted - Number(dash.expected_cash);
  });

  ngOnInit(): void {
    this.reload();
  }

  protected money(value: number): string {
    return formatMoney(value);
  }

  protected formatWhen(iso: string | null | undefined): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('es-CO', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    });
  }

  protected statusLabel(shift: CashShift): string {
    return shift.status === 'open' ? 'Abierto' : 'Cerrado';
  }

  protected reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.dashboard().subscribe({
      next: (dash) => {
        this.data.set(dash);
        this.countedCashText.set(formatMoneyInput(dash.expected_cash));
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el cierre de caja'));
      },
    });
  }

  protected onOpeningCashInput(raw: string): void {
    this.openingCashText.set(raw);
  }

  protected onOpeningCashBlur(): void {
    const amount = parseMoneyInput(this.openingCashText());
    this.openingCashText.set(amount == null ? '' : formatMoneyInput(Math.max(0, amount)));
  }

  protected onCountedCashInput(raw: string): void {
    this.countedCashText.set(raw);
  }

  protected onCountedCashBlur(): void {
    const amount = parseMoneyInput(this.countedCashText());
    this.countedCashText.set(amount == null ? '' : formatMoneyInput(Math.max(0, amount)));
  }

  protected openShift(): void {
    if (!this.canOperate()) return;
    const openingCash = parseMoneyInput(this.openingCashText()) ?? 0;
    if (openingCash < 0) {
      this.error.set('La base en caja no puede ser negativa');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.openShift({ opening_cash: openingCash }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.openingCashText.set('');
        this.reload();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo abrir el turno'));
      },
    });
  }

  protected closeShift(): void {
    if (!this.canOperate()) return;
    const countedCash = parseMoneyInput(this.countedCashText());
    if (countedCash == null || countedCash < 0 || Number.isNaN(countedCash)) {
      this.error.set('Indica el efectivo contado para cerrar el turno');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.closeShift({ counted_cash: countedCash }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.reload();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cerrar el turno'));
      },
    });
  }

  protected userName(): string {
    return this.auth.user()?.name?.split(/\s+/)[0] || 'equipo';
  }

  protected abs(value: number): number {
    return Math.abs(value);
  }
}

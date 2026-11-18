import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { Icon } from '@shared/ui/icon/icon';
import { formatMoney } from '@features/inventory/inventory.model';
import { CashboxApi } from './cashbox.api';
import {
  CashboxDashboard,
  CashShift,
  PaymentMethod,
  SaleKind,
} from './cashbox.model';

@Component({
  selector: 'app-cashbox-page',
  imports: [FormsModule, Icon],
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

  protected openingCash = 0;
  protected countedCash: number | null = null;
  protected saleAmount: number | null = null;
  protected saleMethod: PaymentMethod = 'cash';
  protected saleKind: SaleKind = 'sale';
  protected saleCategory = '';

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
    if (!dash || this.countedCash == null || Number.isNaN(this.countedCash)) return null;
    return Number(this.countedCash) - Number(dash.expected_cash);
  });

  protected readonly briefing = computed(() => {
    const dash = this.data();
    if (!dash) return [] as string[];

    const lines: string[] = [];
    if (this.isPlatformAdmin()) {
      lines.push(
        'Cuenta Administrador: ves el historial de todos los negocios y puedes operar en tu espacio de pruebas (como en desarrollo).',
      );
    }

    const shift = dash.shift;
    if (!shift) {
      lines.push(
        'No hay turno abierto. Antes de vender, abre caja con la base de efectivo real: así el cierre podrá comparar lo esperado contra lo contado.',
        'Un buen control de caja empieza con la base correcta. Si abres en cero y había billetes, el faltante aparecerá al cerrar.',
      );
      return lines;
    }

    lines.push(
      `Turno a cargo de ${shift.opened_by_name}. Base en caja: ${formatMoney(shift.opening_cash)}. Ventas netas del turno: ${formatMoney(dash.shift_sales)} (${dash.sales_count} operaciones).`,
      `Ingresos de contado (efectivo + tarjeta + transferencia + abonos): ${formatMoney(dash.cash_income)}. Efectivo esperado en caja: ${formatMoney(dash.expected_cash)}.`,
    );
    if (dash.sales_count === 0) {
      lines.push(
        'Aún no hay ventas registradas en este turno. Cuando registres ingresos aquí (o desde Ventas), el resumen se arma solo.',
      );
    } else {
      const top = dash.by_category[0];
      if (top) {
        lines.push(
          `La categoría que más aportó es “${top.label}” con ${formatMoney(top.amount)}. Conviene revisar margen y stock de ese rubro.`,
        );
      }
    }
    return lines;
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
        this.countedCash = Number(dash.expected_cash);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el cierre de caja'));
      },
    });
  }

  protected openShift(): void {
    if (!this.canOperate()) return;
    if (this.openingCash < 0) {
      this.error.set('La base en caja no puede ser negativa');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.openShift({ opening_cash: this.openingCash }).subscribe({
      next: () => {
        this.submitting.set(false);
        this.openingCash = 0;
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
    if (this.countedCash == null || this.countedCash < 0 || Number.isNaN(this.countedCash)) {
      this.error.set('Indica el efectivo contado para cerrar el turno');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.closeShift({ counted_cash: this.countedCash }).subscribe({
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

  protected registerSale(): void {
    if (!this.canOperate()) return;
    if (this.saleAmount == null || this.saleAmount <= 0 || Number.isNaN(this.saleAmount)) {
      this.error.set('Indica un monto válido para registrar');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api
      .registerSale({
        kind: this.saleKind,
        payment_method: this.saleMethod,
        amount: this.saleAmount,
        category: this.saleCategory.trim() || null,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.saleAmount = null;
          this.saleCategory = '';
          this.reload();
        },
        error: (err: unknown) => {
          this.submitting.set(false);
          this.error.set(httpErrorMessage(err, 'No se pudo registrar el movimiento'));
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

import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { Icon } from '@shared/ui/icon/icon';
import { InventoryApi } from '@features/inventory/inventory.api';
import {
  InventorySummary,
  Movement,
  Stock,
  formatMoney,
  formatQuantity,
  toNumber,
} from '@features/inventory/inventory.model';
import { ProductsApi } from '@features/products/products.api';
import { ProductStats } from '@features/products/products.model';

type ChartPeriod = 'week' | 'year';
type HealthTone = 'ok' | 'warn' | 'risk';

interface KpiCard {
  label: string;
  value: string;
  hint: string;
  delta: string;
  deltaTone: 'up' | 'down' | 'flat';
  tone: 'green' | 'blue' | 'violet' | 'amber';
}

interface ChartPoint {
  label: string;
  value: number;
  height: number;
}

interface Insight {
  tone: HealthTone;
  title: string;
  detail: string;
  actionLabel?: string;
  actionPath?: string;
}

interface RankItem {
  rank: number;
  name: string;
  meta: string;
  value: string;
}

interface MixSlice {
  label: string;
  value: number;
  money: string;
  pct: number;
  tone: string;
}

@Component({
  selector: 'app-dashboard-page',
  imports: [Icon, RouterLink],
  templateUrl: './dashboard-page.html',
  styleUrl: './dashboard-page.css',
})
export class DashboardPage {
  private readonly inventoryApi = inject(InventoryApi);
  private readonly productsApi = inject(ProductsApi);
  private readonly auth = inject(AuthService);

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly period = signal<ChartPeriod>('week');
  protected readonly today = new Date();
  protected readonly dateLabel = this.today.toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  private readonly movements = signal<Movement[]>([]);
  private readonly lowStock = signal<Stock[]>([]);
  private readonly summary = signal<InventorySummary | null>(null);
  private readonly productStats = signal<ProductStats | null>(null);

  protected readonly firstName = computed(() => {
    const name = this.auth.user()?.name?.trim() || 'equipo';
    return name.split(/\s+/)[0];
  });

  /** Dictamen corto: el tablero “habla solo” como un contador. */
  protected readonly briefing = computed(() => {
    const value = toNumber(this.summary()?.total_value);
    const low = this.summary()?.low_stock ?? 0;
    const warehouses = this.summary()?.warehouses ?? 0;
    const products = this.productStats()?.active ?? 0;
    const week = this.movements().filter((m) => this.isInLastDays(m.created_at, 7));
    const out = this.sumOut(week);
    const inn = this.sumIn(week);
    const net = inn - out;
    const top = this.topItems()[0];

    const paragraphs: string[] = [];
    paragraphs.push(
      `Hoy tu inventario representa ${formatMoney(value)} inmovilizados en mercancía` +
        (warehouses || products
          ? ` (${warehouses} bodega${warehouses === 1 ? '' : 's'}, ${products} producto${products === 1 ? '' : 's'} activo${products === 1 ? '' : 's'})`
          : '') +
        '. Ese capital debe rotar: si se queda quieto, es plata quieta.',
    );

    if (week.length === 0) {
      paragraphs.push(
        'En los últimos 7 días no veo movimientos contables de inventario. Sin entradas ni salidas registradas no puedo medir rotación ni costo de mercancía vendida. Si hubo operación, hay que documentarla para que el libro hable.',
      );
    } else if (net < 0) {
      paragraphs.push(
        `Esta semana las salidas (${formatMoney(out)}) superan las entradas (${formatMoney(inn)}). El inventario se está descapitalizando en ${formatMoney(Math.abs(net))}. Contablemente es señal de demanda, pero también de reposición pendiente.`,
      );
    } else if (net > 0) {
      paragraphs.push(
        `Esta semana reforzaste el activo: entró ${formatMoney(inn)} y salió ${formatMoney(out)}. Quedó un colchón neto de ${formatMoney(net)}. Vigila no sobrecargar bodega si esa mercancía no rota.`,
      );
    } else {
      paragraphs.push(
        `Entradas y salidas de la semana están equilibradas (~${formatMoney(out)}). La operación se ve estable; el siguiente control es el costo y el stock mínimo.`,
      );
    }

    if (low >= 5) {
      paragraphs.push(
        `Dictamen: riesgo alto. Hay ${low} ítems bajo el mínimo. Eso es costo de oportunidad: posible pérdida de venta y ruptura de servicio. Prioriza reposición hoy.`,
      );
    } else if (low > 0) {
      paragraphs.push(
        `Dictamen: observación. ${low} producto(s) bajo el mínimo. No es crisis, pero sí un ajuste de compras para no romper la cadena.`,
      );
    } else {
      paragraphs.push(
        'Dictamen: cobertura de stock en regla. Ningún producto bajo el mínimo. Mantén el control semanal de rotación para conservar liquidez sana.',
      );
    }

    if (top) {
      paragraphs.push(
        `El ítem de mayor rotación (30 días) es “${top.name}” con ${top.value} en salidas. Ese SKU mueve la caja: protégelo con stock y margen claros.`,
      );
    }

    return paragraphs;
  });

  protected readonly health = computed(() => {
    const low = this.summary()?.low_stock ?? 0;
    const weekMoves = this.movements().filter((m) => this.isInLastDays(m.created_at, 7)).length;
    const out = this.sumOut(this.movements().filter((m) => this.isInLastDays(m.created_at, 7)));
    const inn = this.sumIn(this.movements().filter((m) => this.isInLastDays(m.created_at, 7)));

    if (low >= 5) {
      return {
        tone: 'risk' as HealthTone,
        label: 'Dictamen: atención inmediata',
        text: `Hay ${low} referencias bajo el mínimo. Contablemente es un riesgo de quiebre que puede frenar ingresos.`,
      };
    }
    if (weekMoves === 0) {
      return {
        tone: 'warn' as HealthTone,
        label: 'Dictamen: información incompleta',
        text: 'Sin kardex reciente no hay lectura confiable. El tablero necesita movimientos para hablar con precisión.',
      };
    }
    if (out > inn * 1.25 && out > 0) {
      return {
        tone: 'warn' as HealthTone,
        label: 'Dictamen: descapitalización de stock',
        text: 'Las salidas van por delante de las compras. Buena demanda, pero hay que reponer para no quedarse sin activo vendible.',
      };
    }
    if (low > 0) {
      return {
        tone: 'warn' as HealthTone,
        label: 'Dictamen: estable con observaciones',
        text: `${low} producto(s) bajo el mínimo. Corrige reposición y el balance queda limpio.`,
      };
    }
    return {
      tone: 'ok' as HealthTone,
      label: 'Dictamen: situación favorable',
      text: 'Inventario cubierto y con actividad. El activo circulante se ve bajo control.',
    };
  });

  protected readonly kpis = computed<KpiCard[]>(() => {
    const moves = this.movements();
    const todayOut = this.sumOut(moves.filter((m) => this.isSameDay(m.created_at, this.today)));
    const yday = new Date(this.today);
    yday.setDate(yday.getDate() - 1);
    const ydayOut = this.sumOut(moves.filter((m) => this.isSameDay(m.created_at, yday)));

    const weekOut = this.sumOut(moves.filter((m) => this.isInLastDays(m.created_at, 7)));
    const prevWeekOut = this.sumOut(
      moves.filter((m) => this.isBetweenDaysAgo(m.created_at, 14, 7)),
    );

    const weekIn = this.sumIn(moves.filter((m) => this.isInLastDays(m.created_at, 7)));
    const value = toNumber(this.summary()?.total_value);
    const products = this.productStats()?.active ?? 0;
    const warehouses = this.summary()?.warehouses ?? 0;
    const low = this.summary()?.low_stock ?? 0;

    return [
      {
        label: 'Costo de salidas (hoy)',
        value: formatMoney(todayOut),
        hint: 'Valor a costo que salió del inventario hoy (base del Costo de Mercancía)',
        ...this.deltaMeta(todayOut, ydayOut, 'frente a ayer'),
        tone: 'green',
      },
      {
        label: 'Rotación semanal',
        value: formatMoney(weekOut),
        hint: 'Salidas a costo en 7 días: mide qué tan rápido se convierte el stock en operación',
        ...this.deltaMeta(weekOut, prevWeekOut, 'frente a la semana previa'),
        tone: 'blue',
      },
      {
        label: 'Activo en inventario',
        value: formatMoney(value),
        hint: `Capital inmovilizado · ${warehouses} bodega(s) · ${products} SKU activos`,
        delta:
          weekIn > 0
            ? `Compras/entradas de la semana: ${formatMoney(weekIn)}`
            : 'Sin compras registradas esta semana',
        deltaTone: weekIn > 0 ? 'up' : 'flat',
        tone: 'violet',
      },
      {
        label: 'Ítems en riesgo',
        value: String(low),
        hint: 'Referencias bajo el stock mínimo (posible pérdida de venta)',
        delta: low === 0 ? 'Sin exposición material' : 'Requiere orden de compra',
        deltaTone: low === 0 ? 'up' : 'down',
        tone: 'amber',
      },
    ];
  });

  protected readonly insights = computed<Insight[]>(() => {
    const list: Insight[] = [];
    const low = this.summary()?.low_stock ?? 0;
    const weekMoves = this.movements().filter((m) => this.isInLastDays(m.created_at, 7));
    const out = this.sumOut(weekMoves);
    const inn = this.sumIn(weekMoves);
    const value = toNumber(this.summary()?.total_value);
    const top = this.topItems()[0];

    if (low > 0) {
      list.push({
        tone: 'risk',
        title: 'Provisión operativa: stock crítico',
        detail: `Tienes ${low} SKU bajo el mínimo. Desde contabilidad esto es un riesgo de ingreso no realizado: sin mercancía no hay factura. Arma pedido con esos ítems primero.`,
        actionLabel: 'Revisar existencias',
        actionPath: '/inventario/existencias',
      });
    } else {
      list.push({
        tone: 'ok',
        title: 'Cobertura de inventario limpia',
        detail:
          'No hay saldos bajo el mínimo. El activo está respaldado. Siguiente control: revisar si algún SKU de baja rotación está amarrando capital innecesariamente.',
      });
    }

    if (weekMoves.length === 0) {
      list.push({
        tone: 'warn',
        title: 'Kardex sin movimiento',
        detail:
          'Sin entradas/salidas no hay trazabilidad de costo. Un buen cierre semanal exige registrar cada compra, venta o traslado para que el libro cuadre con la realidad.',
        actionLabel: 'Registrar movimiento',
        actionPath: '/inventario/movimientos',
      });
    } else if (out > inn * 1.25 && out > 0) {
      list.push({
        tone: 'warn',
        title: 'Desfase compras vs consumo',
        detail: `Salieron ${formatMoney(out)} y entraron ${formatMoney(inn)}. El inventario se reduce más rápido de lo que se repone: planifica compra para no romper el ciclo de caja.`,
        actionLabel: 'Cargar entrada',
        actionPath: '/inventario/movimientos',
      });
    } else if (inn > out * 1.25 && inn > 0) {
      list.push({
        tone: 'ok',
        title: 'Reposición por encima del consumo',
        detail: `Entró ${formatMoney(inn)} frente a ${formatMoney(out)} en salidas. Aumentaste el activo; confirma que esa mercancía tenga demanda para no hinchar el inventario.`,
      });
    } else {
      list.push({
        tone: 'ok',
        title: 'Flujo de inventario equilibrado',
        detail: `Entradas y salidas de la semana están alineadas. Con un activo de ${formatMoney(value)}, la operación se ve ordenada.`,
      });
    }

    if (top) {
      list.push({
        tone: 'ok',
        title: `SKU motor: ${top.name}`,
        detail: `Concentra ${top.value} en salidas (30 días). Ese producto mueve el resultado: asegúrate de stock, costo unitario y margen antes de que se agote.`,
        actionLabel: 'Ver catálogo',
        actionPath: '/productos/listado',
      });
    } else {
      list.push({
        tone: 'warn',
        title: 'Aún no hay estrella de rotación',
        detail:
          'Cuando registres salidas verás qué SKU genera más movimiento a costo. Eso guía compras y evita comprar “a ciegas”.',
        actionLabel: 'Registrar salida',
        actionPath: '/inventario/movimientos',
      });
    }

    return list.slice(0, 3);
  });

  protected readonly chartPoints = computed<ChartPoint[]>(() => {
    const moves = this.movements();
    if (this.period() === 'week') {
      const days = this.lastNDays(7);
      const values = days.map((day) => this.sumOut(moves.filter((m) => this.isSameDay(m.created_at, day))));
      const max = Math.max(...values, 1);
      return days.map((day, i) => ({
        label: this.weekdayShort(day),
        value: values[i],
        height: Math.max(8, Math.round((values[i] / max) * 100)),
      }));
    }
    const months = this.lastNMonths(12);
    const values = months.map((monthStart) =>
      this.sumOut(moves.filter((m) => this.isSameMonth(m.created_at, monthStart))),
    );
    const max = Math.max(...values, 1);
    return months.map((monthStart, i) => ({
      label: this.monthShort(monthStart),
      value: values[i],
      height: Math.max(8, Math.round((values[i] / max) * 100)),
    }));
  });

  protected readonly chartSummary = computed(() => {
    const points = this.chartPoints();
    const total = points.reduce((a, p) => a + p.value, 0);
    const best = [...points].sort((a, b) => b.value - a.value)[0];
    if (total === 0) {
      return 'Lectura: no hay salidas valorizadas en este período. Sin ese dato no se estima el costo de mercancía movida.';
    }
    return `Lectura: en el período salió mercancía por ${formatMoney(total)} a costo. El pico fue ${best.label} (${formatMoney(best.value)}): ahí se concentró la operación.`;
  });

  protected readonly chartMaxLabel = computed(() => {
    const max = Math.max(...this.chartPoints().map((p) => p.value), 0);
    if (max >= 1_000_000) return `$${(max / 1_000_000).toFixed(1)}M`;
    if (max >= 1000) return `$${(max / 1000).toFixed(0)}k`;
    return formatMoney(max);
  });

  protected readonly mix = computed<MixSlice[]>(() => {
    const week = this.movements().filter((m) => this.isInLastDays(m.created_at, 7));
    const groups: { key: Movement['movement_type']; label: string; tone: string }[] = [
      { key: 'salida', label: 'Salidas', tone: 'out' },
      { key: 'entrada', label: 'Entradas', tone: 'in' },
      { key: 'traslado', label: 'Traslados', tone: 'move' },
      { key: 'ajuste', label: 'Ajustes', tone: 'adj' },
    ];
    const totals = groups.map((g) => ({
      ...g,
      value: this.sumAbs(
        week.filter((m) => m.movement_type === g.key),
      ),
    }));
    const sum = totals.reduce((a, t) => a + t.value, 0) || 1;
    return totals.map((t) => ({
      label: t.label,
      value: t.value,
      money: formatMoney(t.value),
      pct: Math.round((t.value / sum) * 100),
      tone: t.tone,
    }));
  });

  protected readonly topItems = computed<RankItem[]>(() => {
    const map = new Map<string, { name: string; sku: string; total: number; qty: number }>();
    for (const move of this.movements()) {
      if (move.movement_type !== 'salida') continue;
      if (!this.isInLastDays(move.created_at, 30)) continue;
      const key = String(move.product_id);
      const prev =
        map.get(key) ??
        {
          name: move.product_name || 'Producto',
          sku: move.product_sku || '',
          total: 0,
          qty: 0,
        };
      prev.total += Math.abs(toNumber(move.total_cost));
      prev.qty += Math.abs(toNumber(move.quantity));
      map.set(key, prev);
    }
    return [...map.values()]
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)
      .map((item, index) => ({
        rank: index + 1,
        name: item.name,
        meta: `${item.sku ? item.sku + ' · ' : ''}${formatQuantity(item.qty)} und.`,
        value: formatMoney(item.total),
      }));
  });

  protected readonly lowStockItems = computed(() =>
    this.lowStock()
      .slice(0, 5)
      .map((row) => ({
        name: row.product_name || row.product_sku || 'Producto',
        warehouse: row.warehouse_name || '—',
        qty: formatQuantity(row.quantity),
        min: formatQuantity(row.min_stock),
      })),
  );

  constructor() {
    this.load();
  }

  protected setPeriod(period: ChartPeriod): void {
    this.period.set(period);
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    forkJoin({
      summary: this.inventoryApi.summary(),
      movements: this.inventoryApi.movements(),
      low: this.inventoryApi.stock({ lowStock: true }),
      products: this.productsApi.stats(),
    }).subscribe({
      next: ({ summary, movements, low, products }) => {
        this.summary.set(summary);
        this.movements.set(movements);
        this.lowStock.set(low);
        this.productStats.set(products);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el inicio'));
      },
    });
  }

  private deltaMeta(
    current: number,
    previous: number,
    label: string,
  ): Pick<KpiCard, 'delta' | 'deltaTone'> {
    if (previous <= 0 && current <= 0) {
      return { delta: `Sin cambio ${label}`, deltaTone: 'flat' };
    }
    if (previous <= 0 && current > 0) {
      return { delta: `Nuevo ritmo ${label}`, deltaTone: 'up' };
    }
    const pct = Math.round(((current - previous) / previous) * 100);
    if (pct === 0) return { delta: `Igual ${label}`, deltaTone: 'flat' };
    if (pct > 0) return { delta: `+${pct}% ${label}`, deltaTone: 'up' };
    return { delta: `${pct}% ${label}`, deltaTone: 'down' };
  }

  private sumOut(items: Movement[]): number {
    return items
      .filter((m) => m.movement_type === 'salida')
      .reduce((acc, m) => acc + Math.abs(toNumber(m.total_cost)), 0);
  }

  private sumIn(items: Movement[]): number {
    return items
      .filter((m) => m.movement_type === 'entrada')
      .reduce((acc, m) => acc + Math.abs(toNumber(m.total_cost)), 0);
  }

  private sumAbs(items: Movement[]): number {
    return items.reduce((acc, m) => acc + Math.abs(toNumber(m.total_cost)), 0);
  }

  private isSameDay(iso: string, day: Date): boolean {
    const d = new Date(iso);
    return (
      d.getFullYear() === day.getFullYear() &&
      d.getMonth() === day.getMonth() &&
      d.getDate() === day.getDate()
    );
  }

  private isSameMonth(iso: string, monthStart: Date): boolean {
    const d = new Date(iso);
    return d.getFullYear() === monthStart.getFullYear() && d.getMonth() === monthStart.getMonth();
  }

  private isInLastDays(iso: string, days: number): boolean {
    const d = new Date(iso).getTime();
    return d >= Date.now() - days * 86400000;
  }

  private isBetweenDaysAgo(iso: string, fromDays: number, toDays: number): boolean {
    const t = new Date(iso).getTime();
    const now = Date.now();
    return t < now - toDays * 86400000 && t >= now - fromDays * 86400000;
  }

  private lastNDays(n: number): Date[] {
    const days: Date[] = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(12, 0, 0, 0);
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  }

  private lastNMonths(n: number): Date[] {
    const months: Date[] = [];
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      months.push(new Date(now.getFullYear(), now.getMonth() - i, 1));
    }
    return months;
  }

  private weekdayShort(day: Date): string {
    const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    if (this.isSameDay(day.toISOString(), this.today)) return 'Hoy';
    return labels[day.getDay()];
  }

  private monthShort(day: Date): string {
    return day.toLocaleDateString('es-CO', { month: 'short' }).replace('.', '');
  }
}

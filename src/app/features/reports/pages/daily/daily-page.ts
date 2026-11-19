import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { Subscription, forkJoin, of } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop } from '@core/money/money';
import { NO_LOCATION_MESSAGE, needsLocationAssignment } from '@features/locations/location-rules';
import { Location } from '@features/locations/location.model';
import { LocationsApi } from '@features/locations/locations.api';
import { PageHeader } from '@shared/ui/page-header/page-header';
import {
  CASH_NET_NOTE,
  CLOSED_DIFFERENCE_NOTE,
  FULL_SHIFT_NOTE,
  MIDNIGHT_NOTE,
  OPEN_SHIFT_LABEL,
  REPORT_ERRORS,
  bogotaToday,
  differenceLabel,
  isEmptyDay,
  isOpenShift,
  isValidReportDate,
  reportErrorKind,
  shiftStateLabel,
} from '../../daily-report';
import { DailyReportApi } from '../../daily-report.api';
import { DailyReport, ShiftReport } from '../../daily-report.model';
import { ReportSectionTable } from './report-section';

/**
 * Informe diario de una sede (solo Administrador y Supervisor). Todo viene de la API: el front no recalcula nada,
 * solo normaliza y rotula. Un 403 o un 404 se muestran aquí y no tocan la sesión.
 */
@Component({
  selector: 'app-daily-page',
  imports: [DatePipe, PageHeader, ReportSectionTable],
  templateUrl: './daily-page.html',
})
export class DailyPage {
  private readonly api = inject(DailyReportApi);
  private readonly locationsApi = inject(LocationsApi);
  protected readonly auth = inject(AuthService);
  private request: Subscription | null = null;

  protected readonly formatCop = formatCop;
  protected readonly noLocationMessage = NO_LOCATION_MESSAGE;
  protected readonly openLabel = OPEN_SHIFT_LABEL;
  protected readonly fullShiftNote = FULL_SHIFT_NOTE;
  protected readonly closedNote = CLOSED_DIFFERENCE_NOTE;
  protected readonly midnightNote = MIDNIGHT_NOTE;
  protected readonly cashNote = CASH_NET_NOTE;
  protected readonly shiftState = shiftStateLabel;
  protected readonly differenceLabel = differenceLabel;
  protected readonly isOpen = isOpenShift;
  /** Colombia no tiene horario de verano: -05:00 todo el año. */
  protected readonly bogota = '-0500';

  protected readonly today = bogotaToday();
  protected readonly date = signal(this.today);
  protected readonly locationId = signal<number | null>(null);
  protected readonly locations = signal<Location[]>([]);
  protected readonly assigned = signal<number[]>([]);
  protected readonly loadingLocations = signal(true);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly report = signal<DailyReport | null>(null);

  protected readonly withoutLocation = computed(
    () => !this.loadingLocations() && needsLocationAssignment(this.auth.user(), this.assigned()),
  );
  /** El Administrador elige entre todas las sedes; el Supervisor, entre las asignadas. */
  protected readonly options = computed(() => {
    if (this.auth.hasRole('Administrador')) return this.locations();
    const allowed = new Set(this.assigned());
    return this.locations().filter((l) => allowed.has(l.id));
  });
  protected readonly empty = computed(() => {
    const report = this.report();
    return report !== null && isEmptyDay(report);
  });
  protected readonly anyCrossesMidnight = computed(() => this.report()?.shifts.some((s) => s.crosses_midnight) ?? false);

  constructor() {
    const user = this.auth.user();
    forkJoin({
      locations: this.locationsApi.list(),
      mine:
        user && !this.auth.hasRole('Administrador')
          ? this.locationsApi.userLocations(user.id)
          : of({ user_id: 0, location_ids: [] as number[] }),
    }).subscribe({
      next: ({ locations, mine }) => {
        this.locations.set(locations);
        this.assigned.set(mine.location_ids);
        this.loadingLocations.set(false);
        const first = this.options().find((l) => l.is_active) ?? this.options()[0];
        if (first) {
          this.locationId.set(first.id);
          this.load();
        }
      },
      error: (err: unknown) => {
        this.loadingLocations.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las sedes'));
      },
    });
  }

  protected onLocation(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.locationId.set(value ? Number(value) : null);
    this.load();
  }

  protected onDate(event: Event): void {
    this.date.set((event.target as HTMLInputElement).value);
    this.load();
  }

  protected goToday(): void {
    this.date.set(this.today);
    this.load();
  }

  protected load(): void {
    this.request?.unsubscribe();
    const locationId = this.locationId();
    const date = this.date();
    this.error.set(null);
    if (locationId === null) {
      this.report.set(null);
      return;
    }
    if (!isValidReportDate(date)) {
      this.report.set(null);
      this.error.set('Elige una fecha válida.');
      return;
    }
    this.loading.set(true);
    this.request = this.api.daily(locationId, date).subscribe({
      next: (report) => {
        this.loading.set(false);
        this.report.set(report);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.report.set(null);
        const kind = reportErrorKind(err);
        this.error.set(kind === 'other' ? httpErrorMessage(err, 'No se pudo cargar el informe') : REPORT_ERRORS[kind]);
      },
    });
  }

  protected shiftTitle(shift: ShiftReport): string {
    return `${shift.register_code} · ${shift.user_name}`;
  }
}

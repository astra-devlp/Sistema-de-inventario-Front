import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of, throwError } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { formatCop, parseMoney } from '@core/money/money';
import { NO_LOCATION_MESSAGE, needsLocationAssignment } from '@features/locations/location-rules';
import { CashRegister, Location } from '@features/locations/location.model';
import { CashRegistersApi, LocationsApi } from '@features/locations/locations.api';
import { UsersApi } from '@features/users/users.api';
import { Modal } from '@shared/ui/modal/modal';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { OpenConflict, isNoCurrentShift, openShiftConflict } from '../../shift-rules';
import { ShiftApi } from '../../shift.api';
import { Shift } from '../../shift.model';
import { CloseShiftModal, CloseTarget } from './close-shift-modal';
import { ShiftResult } from './shift-result';

const PAGE_SIZE = 100;

@Component({
  selector: 'app-shift-page',
  imports: [DatePipe, FormsModule, PageHeader, Modal, CloseShiftModal, ShiftResult],
  templateUrl: './shift-page.html',
})
export class ShiftPage {
  private readonly api = inject(ShiftApi);
  private readonly registersApi = inject(CashRegistersApi);
  private readonly locationsApi = inject(LocationsApi);
  private readonly usersApi = inject(UsersApi);
  protected readonly auth = inject(AuthService);

  protected readonly noLocationMessage = NO_LOCATION_MESSAGE;
  protected readonly formatCop = formatCop;

  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly current = signal<Shift | null>(null);
  protected readonly registers = signal<CashRegister[]>([]);
  protected readonly locations = signal<Location[]>([]);
  protected readonly assigned = signal<number[]>([]);
  protected readonly userNames = signal<Map<number, string>>(new Map());
  protected readonly shifts = signal<Shift[]>([]);
  protected readonly hasMore = signal(false);
  protected readonly statusFilter = signal<'abierto' | 'cerrado' | ''>('');

  protected readonly registerId = signal<number | null>(null);
  protected readonly openingCash = signal('0');
  protected readonly opening = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly conflict = signal<OpenConflict | null>(null);

  protected readonly closeTarget = signal<CloseTarget | null>(null);
  protected readonly detail = signal<Shift | null>(null);

  /** Supervisor y Administrador ven la lista de turnos de sus sedes; el Cajero solo ve su turno actual. */
  protected readonly isStaff = computed(() => this.auth.hasRole('Administrador', 'Supervisor'));
  protected readonly withoutLocation = computed(
    () => !this.loading() && needsLocationAssignment(this.auth.user(), this.assigned()),
  );

  private readonly locationNames = computed(() => new Map(this.locations().map((l) => [l.id, l.name])));
  private readonly registerById = computed(() => new Map(this.registers().map((r) => [r.id, r])));
  /** Cajas donde se puede abrir turno: activas y de una sede activa (la API ya deja solo las de las sedes asignadas). */
  protected readonly openable = computed(() => {
    const active = new Set(this.locations().filter((l) => l.is_active).map((l) => l.id));
    return this.registers().filter((r) => r.is_active && active.has(r.location_id));
  });

  constructor() {
    this.load();
  }

  protected registerLabel(id: number): string {
    const register = this.registerById().get(id);
    return register ? `${register.code} · ${register.name}` : `Caja ${id}`;
  }

  protected locationName(id: number): string {
    return this.locationNames().get(id) ?? `Sede ${id}`;
  }

  protected userName(id: number): string {
    return this.userNames().get(id) ?? `Usuario #${id}`;
  }

  protected onRegister(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.registerId.set(value ? Number(value) : null);
  }

  protected openShift(): void {
    this.formError.set(null);
    this.conflict.set(null);
    const registerId = this.registerId();
    if (registerId === null) {
      this.formError.set('Elige la caja');
      return;
    }
    const cash = parseMoney(this.openingCash());
    if (!cash.ok) {
      this.formError.set(cash.error);
      return;
    }
    this.opening.set(true);
    this.api.open({ cash_register_id: registerId, opening_cash: cash.value }).subscribe({
      next: (shift) => {
        this.opening.set(false);
        this.current.set(shift);
        this.reloadList();
      },
      error: (err: unknown) => {
        this.opening.set(false);
        const conflict = openShiftConflict(err);
        if (conflict) this.conflict.set(conflict);
        else this.formError.set(httpErrorMessage(err, 'No se pudo abrir el turno'));
      },
    });
  }

  /** «Ya tienes un turno abierto»: se trae ese turno para mostrarlo. */
  protected showMine(): void {
    this.conflict.set(null);
    this.load();
  }

  protected closeMine(): void {
    const shift = this.current();
    if (shift) this.closeTarget.set(this.target(shift, false));
  }

  protected forceClose(shift: Shift): void {
    this.closeTarget.set(this.target(shift, shift.user_id !== this.auth.user()?.id));
  }

  protected closeDismissed(closed: boolean): void {
    this.closeTarget.set(null);
    if (closed) this.load();
  }

  protected canForce(shift: Shift): boolean {
    return shift.status === 'abierto' && shift.user_id !== this.auth.user()?.id;
  }

  protected onStatus(event: Event): void {
    this.statusFilter.set((event.target as HTMLSelectElement).value as 'abierto' | 'cerrado' | '');
    this.reloadList();
  }

  protected openDetail(shift: Shift): void {
    this.api.get(shift.id).subscribe({
      next: (full) => this.detail.set(full),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudo cargar el turno')),
    });
  }

  protected loadMore(): void {
    this.fetchList(this.shifts().length);
  }

  protected reloadList(): void {
    if (this.isStaff()) this.fetchList(0);
  }

  private target(shift: Shift, forced: boolean): CloseTarget {
    return { shift, forced, registerLabel: this.registerLabel(shift.cash_register_id), ownerLabel: this.userName(shift.user_id) };
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    const user = this.auth.user();
    forkJoin({
      // El 404 de /current es «sin turno»: no es un error ni toca la sesión (solo el 401 la cierra).
      current: this.api.current().pipe(catchError((err: unknown) => (isNoCurrentShift(err) ? of(null) : throwError(() => err)))),
      registers: this.registersApi.list(),
      locations: this.locationsApi.list(),
      mine: user ? this.locationsApi.userLocations(user.id) : of({ user_id: 0, location_ids: [] as number[] }),
      users: this.isStaff() ? this.usersApi.list().pipe(catchError(() => of([]))) : of([]),
    }).subscribe({
      next: ({ current, registers, locations, mine, users }) => {
        this.current.set(current);
        this.registers.set(registers);
        this.locations.set(locations);
        this.assigned.set(mine.location_ids);
        this.userNames.set(new Map(users.map((u) => [u.id, u.name])));
        if (this.registerId() === null) this.registerId.set(this.openable()[0]?.id ?? null);
        this.loading.set(false);
        this.reloadList();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudo cargar el turno'));
      },
    });
  }

  private fetchList(offset: number): void {
    this.api.list({ status: this.statusFilter(), limit: PAGE_SIZE, offset }).subscribe({
      next: (page) => {
        this.shifts.set(offset === 0 ? page : [...this.shifts(), ...page]);
        this.hasMore.set(page.length === PAGE_SIZE);
      },
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar los turnos')),
    });
  }
}

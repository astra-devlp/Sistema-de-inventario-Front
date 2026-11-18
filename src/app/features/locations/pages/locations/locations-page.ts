import { Component, computed, inject, signal } from '@angular/core';
import { Observable, forkJoin, of } from 'rxjs';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { deleteConflictMessage, isConflict } from '@core/api/api-error';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CashRegister, Location } from '../../location.model';
import { NO_LOCATION_MESSAGE, needsLocationAssignment } from '../../location-rules';
import { CashRegistersApi, LocationsApi } from '../../locations.api';
import { CashRegisterFormModal } from './modals/cash-register-form-modal';
import { LocationFormModal } from './modals/location-form-modal';

type Modal = 'location' | 'register' | 'delete-location' | 'delete-register' | null;
/** Tras un 409 al borrar se propone desactivar lo mismo que se quiso borrar. */
type Offer = { kind: 'location'; item: Location } | { kind: 'register'; item: CashRegister } | null;

@Component({
  selector: 'app-locations-page',
  imports: [PageHeader, Icon, ConfirmModal, LocationFormModal, CashRegisterFormModal],
  templateUrl: './locations-page.html',
})
export class LocationsPage {
  private readonly locationsApi = inject(LocationsApi);
  private readonly registersApi = inject(CashRegistersApi);
  protected readonly auth = inject(AuthService);

  protected readonly noLocationMessage = NO_LOCATION_MESSAGE;
  protected readonly locations = signal<Location[]>([]);
  protected readonly registers = signal<CashRegister[]>([]);
  /** Sedes asignadas al usuario de la sesión (el Administrador opera en todas). */
  protected readonly assigned = signal<number[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly offer = signal<Offer>(null);
  protected readonly modal = signal<Modal>(null);
  protected readonly selectedLocation = signal<Location | null>(null);
  protected readonly selectedRegister = signal<CashRegister | null>(null);

  protected readonly isAdmin = computed(() => this.auth.isCompanyAdmin());
  protected readonly withoutLocation = computed(
    () => !this.loading() && needsLocationAssignment(this.auth.user(), this.assigned()),
  );
  /** El Administrador ve todas las sedes; los demás, solo las suyas. */
  protected readonly visibleLocations = computed(() =>
    this.isAdmin() ? this.locations() : this.locations().filter((l) => this.assigned().includes(l.id)),
  );
  private readonly locationNames = computed(() => new Map(this.locations().map((l) => [l.id, l.name])));

  constructor() {
    this.load();
  }

  protected locationName(id: number): string {
    return this.locationNames().get(id) ?? `Sede ${id}`;
  }

  protected openLocation(location: Location | null): void {
    this.selectedLocation.set(location);
    this.modal.set('location');
  }

  protected openRegister(register: CashRegister | null): void {
    this.selectedRegister.set(register);
    this.modal.set('register');
  }

  protected askDelete(kind: 'location' | 'register', item: Location | CashRegister): void {
    if (kind === 'location') this.selectedLocation.set(item as Location);
    else this.selectedRegister.set(item as CashRegister);
    this.modal.set(kind === 'location' ? 'delete-location' : 'delete-register');
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedLocation.set(null);
    this.selectedRegister.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected makeDefault(location: Location): void {
    this.run(this.locationsApi.update(location.id, { is_default: true }), 'No se pudo cambiar la sede por defecto');
  }

  protected toggleLocation(location: Location): void {
    this.run(this.locationsApi.update(location.id, { is_active: !location.is_active }), 'No se pudo cambiar el estado');
  }

  protected toggleRegister(register: CashRegister): void {
    this.run(this.registersApi.update(register.id, { is_active: !register.is_active }), 'No se pudo cambiar el estado');
  }

  protected removeLocation(): void {
    const location = this.selectedLocation();
    if (!location) return;
    this.locationsApi.delete(location.id).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => {
        this.close();
        this.error.set(deleteConflictMessage(err, 'No se pudo eliminar la sede'));
        this.offer.set(isConflict(err) && !location.is_default ? { kind: 'location', item: location } : null);
      },
    });
  }

  protected removeRegister(): void {
    const register = this.selectedRegister();
    if (!register) return;
    this.registersApi.delete(register.id).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => {
        this.close();
        this.error.set(deleteConflictMessage(err, 'No se pudo eliminar la caja'));
        this.offer.set(isConflict(err) ? { kind: 'register', item: register } : null);
      },
    });
  }

  protected acceptOffer(): void {
    const offer = this.offer();
    if (!offer) return;
    const request =
      offer.kind === 'location'
        ? this.locationsApi.update(offer.item.id, { is_active: false })
        : this.registersApi.update(offer.item.id, { is_active: false });
    this.run(request, 'No se pudo desactivar');
  }

  protected dismissError(): void {
    this.error.set(null);
    this.offer.set(null);
  }

  private run(request: Observable<unknown>, fallback: string): void {
    this.dismissError();
    request.subscribe({
      next: () => this.load(),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, fallback)),
    });
  }

  private load(): void {
    this.loading.set(true);
    this.dismissError();
    const user = this.auth.user();
    forkJoin({
      locations: this.locationsApi.list(),
      registers: this.registersApi.list(),
      mine: user ? this.locationsApi.userLocations(user.id) : of({ user_id: 0, location_ids: [] as number[] }),
    }).subscribe({
      next: ({ locations, registers, mine }) => {
        this.locations.set(locations);
        this.registers.set(registers);
        this.assigned.set(mine.location_ids);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las sedes y cajas'));
      },
    });
  }
}

import { Component, effect, inject, input, output, signal } from '@angular/core';
import { AuthUser } from '@core/auth/auth.model';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Location } from '@features/locations/location.model';
import { toggleLocation } from '@features/locations/location-rules';
import { LocationsApi } from '@features/locations/locations.api';
import { Modal } from '@shared/ui/modal/modal';

/** Sedes en las que un usuario opera la caja: `PUT /users/{id}/locations` reemplaza la lista completa. */
@Component({
  selector: 'app-user-locations-modal',
  imports: [Modal],
  templateUrl: './user-locations-modal.html',
})
export class UserLocationsModal {
  private readonly api = inject(LocationsApi);

  readonly open = input(false);
  readonly user = input<AuthUser | null>(null);
  readonly closed = output<void>();
  readonly saved = output<void>();

  protected readonly locations = signal<Location[]>([]);
  protected readonly selected = signal<number[]>([]);
  protected readonly loading = signal(false);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    effect(() => {
      const user = this.user();
      if (!this.open() || !user) return;
      this.error.set(null);
      this.loading.set(true);
      this.api.list().subscribe({
        next: (locations) => {
          this.api.userLocations(user.id).subscribe({
            next: (assigned) => {
              this.locations.set(locations);
              this.selected.set(assigned.location_ids);
              this.loading.set(false);
            },
            error: (err: unknown) => this.fail(err, 'No se pudieron cargar las sedes del usuario'),
          });
        },
        error: (err: unknown) => this.fail(err, 'No se pudieron cargar las sedes'),
      });
    });
  }

  protected isChecked(id: number): boolean {
    return this.selected().includes(id);
  }

  protected toggle(id: number, event: Event): void {
    this.selected.update((ids) => toggleLocation(ids, id, (event.target as HTMLInputElement).checked));
  }

  protected submit(): void {
    const user = this.user();
    if (!user) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api.setUserLocations(user.id, this.selected()).subscribe({
      next: () => {
        this.submitting.set(false);
        this.saved.emit();
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron guardar las sedes'));
      },
    });
  }

  private fail(err: unknown, fallback: string): void {
    this.loading.set(false);
    this.error.set(httpErrorMessage(err, fallback));
  }
}

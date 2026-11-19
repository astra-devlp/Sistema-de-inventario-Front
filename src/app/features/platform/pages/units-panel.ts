import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Unit } from '@features/products/catalog.model';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { platformErrorMessage } from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { UnitFormModal } from './unit-form-modal';

type UnitsModal = 'form' | 'delete' | null;

/** Unidades globales: solo plataforma las crea, edita o borra. Los 409 de la API se muestran tal cual. */
@Component({
  selector: 'app-units-panel',
  imports: [Icon, UnitFormModal, ConfirmModal],
  templateUrl: './units-panel.html',
})
export class UnitsPanel {
  private readonly api = inject(PlatformApi);

  protected readonly units = signal<Unit[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UnitsModal>(null);
  protected readonly selected = signal<Unit | null>(null);

  constructor() {
    this.load();
  }

  protected edit(unit: Unit | null): void {
    this.selected.set(unit);
    this.modal.set('form');
  }

  protected askDelete(unit: Unit): void {
    this.selected.set(unit);
    this.modal.set('delete');
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const unit = this.selected();
    if (!unit) return;
    this.api.deleteUnit(unit.id).subscribe({
      next: () => this.saved(),
      error: (err: unknown) => {
        this.close();
        this.error.set(platformErrorMessage(err, 'No se pudo eliminar la unidad'));
      },
    });
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.units().subscribe({
      next: (units) => {
        this.units.set(units);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las unidades'));
      },
    });
  }
}

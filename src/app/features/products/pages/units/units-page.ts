import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PresentationsApi, UnitsApi } from '../../products.api';
import { Presentation, Unit } from '../../products.model';
import { PresentationFormModal } from './modals/presentation-form-modal';
import { UnitFormModal } from './modals/unit-form-modal';

type UnitsModal = 'unit-create' | 'unit-edit' | 'pres-create' | 'pres-edit' | 'unit-delete' | 'pres-delete' | null;

@Component({
  selector: 'app-units-page',
  imports: [PageHeader, Icon, UnitFormModal, PresentationFormModal, ConfirmModal],
  templateUrl: './units-page.html',
})
export class UnitsPage {
  private readonly unitsApi = inject(UnitsApi);
  private readonly presentationsApi = inject(PresentationsApi);

  protected readonly units = signal<Unit[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UnitsModal>(null);
  protected readonly selectedUnit = signal<Unit | null>(null);
  protected readonly selectedPresentation = signal<Presentation | null>(null);

  private readonly unitLabels = computed(() => new Map(this.units().map((u) => [u.id, `${u.name} (${u.abbreviation})`])));

  constructor() {
    this.reload();
  }

  protected unitLabel(unitId: number): string {
    return this.unitLabels().get(unitId) ?? '—';
  }

  protected openUnit(modal: UnitsModal, unit: Unit | null = null): void {
    this.selectedUnit.set(unit);
    this.selectedPresentation.set(null);
    this.modal.set(modal);
  }

  protected openPresentation(modal: UnitsModal, presentation: Presentation | null = null): void {
    this.selectedPresentation.set(presentation);
    this.selectedUnit.set(null);
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedUnit.set(null);
    this.selectedPresentation.set(null);
  }

  protected saved(): void {
    this.close();
    this.reload();
  }

  protected confirmDelete(): void {
    const unit = this.selectedUnit();
    const presentation = this.selectedPresentation();
    if (unit) this.run(this.unitsApi.delete(unit.id), 'No se pudo eliminar la unidad');
    else if (presentation) this.run(this.presentationsApi.delete(presentation.id), 'No se pudo eliminar la presentación');
  }

  private run(request: ReturnType<UnitsApi['delete']>, fallback: string): void {
    request.subscribe({
      next: () => {
        this.close();
        this.reload();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, fallback));
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.error.set(null);
    this.unitsApi.list().subscribe({
      next: (units) => {
        this.units.set(units);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las unidades'));
      },
    });
    this.presentationsApi.list().subscribe({
      next: (presentations) => this.presentations.set(presentations),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las presentaciones')),
    });
  }
}

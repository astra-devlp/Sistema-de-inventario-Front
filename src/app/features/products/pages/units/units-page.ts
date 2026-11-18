import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CatalogApi } from '../../catalog.api';
import { Presentation, Unit } from '../../catalog.model';
import { PresentationFormModal } from './modals/presentation-form-modal';
import { UnitFormModal } from './modals/unit-form-modal';

type UnitsModal = 'unit-create' | 'unit-edit' | 'pres-create' | 'pres-edit' | 'delete' | null;

/** Lo que se va a eliminar: una unidad o una presentación. */
type Deletion = { kind: 'unit'; item: Unit } | { kind: 'presentation'; item: Presentation };

@Component({
  selector: 'app-units-page',
  imports: [PageHeader, Icon, UnitFormModal, PresentationFormModal, ConfirmModal],
  templateUrl: './units-page.html',
})
export class UnitsPage {
  private readonly api = inject(CatalogApi);

  protected readonly units = signal<Unit[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UnitsModal>(null);
  protected readonly selectedUnit = signal<Unit | null>(null);
  protected readonly selectedPresentation = signal<Presentation | null>(null);
  protected readonly deletion = signal<Deletion | null>(null);

  private readonly unitNames = computed(() => new Map(this.units().map((unit) => [unit.id, `${unit.name} (${unit.abbreviation})`])));

  constructor() {
    this.load();
  }

  protected unitName(presentation: Presentation): string {
    return this.unitNames().get(presentation.unit_id) ?? '—';
  }

  protected editUnit(unit: Unit | null): void {
    this.selectedUnit.set(unit);
    this.modal.set(unit ? 'unit-edit' : 'unit-create');
  }

  protected editPresentation(presentation: Presentation | null): void {
    this.selectedPresentation.set(presentation);
    this.modal.set(presentation ? 'pres-edit' : 'pres-create');
  }

  protected askDelete(deletion: Deletion): void {
    this.deletion.set(deletion);
    this.modal.set('delete');
  }

  protected deleteMessage(): string {
    const deletion = this.deletion();
    if (!deletion) return '¿Deseas eliminar este registro?';
    const label = deletion.kind === 'unit' ? 'la unidad' : 'la presentación';
    return `¿Deseas eliminar ${label} ${deletion.item.name}?`;
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedUnit.set(null);
    this.selectedPresentation.set(null);
    this.deletion.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const deletion = this.deletion();
    if (!deletion) return;
    const request =
      deletion.kind === 'unit' ? this.api.deleteUnit(deletion.item.id) : this.api.deletePresentation(deletion.item.id);
    const fallback = deletion.kind === 'unit' ? 'No se pudo eliminar la unidad' : 'No se pudo eliminar la presentación';
    request.subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, fallback));
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
    this.api.presentations().subscribe({
      next: (presentations) => this.presentations.set(presentations),
      error: (err: unknown) => this.error.set(httpErrorMessage(err, 'No se pudieron cargar las presentaciones')),
    });
  }
}

import { Component, computed, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CatalogApi } from '../../catalog.api';
import { Presentation, Unit } from '../../catalog.model';
import { PresentationFormModal } from './modals/presentation-form-modal';

type UnitsModal = 'pres-create' | 'pres-edit' | 'delete' | null;

@Component({
  selector: 'app-units-page',
  imports: [PageHeader, Icon, PresentationFormModal, ConfirmModal],
  templateUrl: './units-page.html',
})
export class UnitsPage {
  private readonly api = inject(CatalogApi);

  protected readonly units = signal<Unit[]>([]);
  protected readonly presentations = signal<Presentation[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly modal = signal<UnitsModal>(null);
  protected readonly selectedPresentation = signal<Presentation | null>(null);
  protected readonly deletion = signal<Presentation | null>(null);

  private readonly unitNames = computed(() => new Map(this.units().map((unit) => [unit.id, `${unit.name} (${unit.abbreviation})`])));

  constructor() {
    this.load();
  }

  protected unitName(presentation: Presentation): string {
    return this.unitNames().get(presentation.unit_id) ?? '—';
  }

  protected editPresentation(presentation: Presentation | null): void {
    this.selectedPresentation.set(presentation);
    this.modal.set(presentation ? 'pres-edit' : 'pres-create');
  }

  protected askDelete(presentation: Presentation): void {
    this.deletion.set(presentation);
    this.modal.set('delete');
  }

  protected deleteMessage(): string {
    const presentation = this.deletion();
    if (!presentation) return '¿Deseas eliminar este registro?';
    return `¿Deseas eliminar la presentación ${presentation.name}?`;
  }

  protected close(): void {
    this.modal.set(null);
    this.selectedPresentation.set(null);
    this.deletion.set(null);
  }

  protected saved(): void {
    this.close();
    this.load();
  }

  protected remove(): void {
    const presentation = this.deletion();
    if (!presentation) return;
    this.api.deletePresentation(presentation.id).subscribe({
      next: () => {
        this.close();
        this.load();
      },
      error: (err: unknown) => {
        this.close();
        this.error.set(httpErrorMessage(err, 'No se pudo eliminar la presentación'));
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

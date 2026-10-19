import { Component, signal } from '@angular/core';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PresentationFormModal } from './modals/presentation-form-modal';
import { UnitFormModal } from './modals/unit-form-modal';

type UnitsModal = 'unit-create' | 'unit-edit' | 'pres-create' | 'pres-edit' | 'delete' | null;

@Component({
  selector: 'app-units-page',
  imports: [PageHeader, Icon, UnitFormModal, PresentationFormModal, ConfirmModal],
  templateUrl: './units-page.html',
})
export class UnitsPage {
  protected readonly placeholderRows = [1, 2, 3];
  protected readonly modal = signal<UnitsModal>(null);

  protected open(modal: UnitsModal): void {
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
  }
}

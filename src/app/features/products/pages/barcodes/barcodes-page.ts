import { Component, signal } from '@angular/core';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { BarcodeFormModal } from './modals/barcode-form-modal';

type BarcodeModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-barcodes-page',
  imports: [PageHeader, Icon, BarcodeFormModal, ConfirmModal],
  templateUrl: './barcodes-page.html',
})
export class BarcodesPage {
  protected readonly placeholderRows = [1, 2, 3, 4];
  protected readonly modal = signal<BarcodeModal>(null);

  protected open(modal: BarcodeModal): void {
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
  }
}

import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-barcode-form-modal',
  imports: [Modal],
  templateUrl: './barcode-form-modal.html',
})
export class BarcodeFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

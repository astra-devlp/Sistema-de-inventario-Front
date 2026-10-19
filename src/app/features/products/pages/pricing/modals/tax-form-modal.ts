import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-tax-form-modal',
  imports: [Modal],
  templateUrl: './tax-form-modal.html',
})
export class TaxFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

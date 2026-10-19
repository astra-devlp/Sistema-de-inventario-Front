import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-price-form-modal',
  imports: [Modal],
  templateUrl: './price-form-modal.html',
})
export class PriceFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

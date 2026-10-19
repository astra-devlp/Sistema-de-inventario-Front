import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-product-form-modal',
  imports: [Modal],
  templateUrl: './product-form-modal.html',
})
export class ProductFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

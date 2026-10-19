import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-product-detail-modal',
  imports: [Modal],
  templateUrl: './product-detail-modal.html',
})
export class ProductDetailModal {
  readonly open = input(false);
  readonly closed = output<void>();
}

import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';
import { Product, formatMoney } from '../../../products.model';

@Component({
  selector: 'app-product-detail-modal',
  imports: [Modal],
  templateUrl: './product-detail-modal.html',
})
export class ProductDetailModal {
  readonly open = input(false);
  readonly product = input<Product | null>(null);
  readonly categoryName = input('—');
  readonly presentationName = input('—');
  readonly taxLabel = input('—');
  readonly unitName = input('—');
  readonly closed = output<void>();
  protected readonly formatMoney = formatMoney;
}

import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-category-form-modal',
  imports: [Modal],
  templateUrl: './category-form-modal.html',
})
export class CategoryFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

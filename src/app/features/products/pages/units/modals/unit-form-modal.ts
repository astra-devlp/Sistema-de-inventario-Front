import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-unit-form-modal',
  imports: [Modal],
  templateUrl: './unit-form-modal.html',
})
export class UnitFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

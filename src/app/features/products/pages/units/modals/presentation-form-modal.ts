import { Component, input, output } from '@angular/core';
import { Modal } from '@shared/ui/modal/modal';

@Component({
  selector: 'app-presentation-form-modal',
  imports: [Modal],
  templateUrl: './presentation-form-modal.html',
})
export class PresentationFormModal {
  readonly open = input(false);
  readonly editing = input(false);
  readonly closed = output<void>();
}

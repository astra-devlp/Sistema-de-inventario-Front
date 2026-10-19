import { Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';
import { Modal } from '../modal/modal';

/** Modal reutilizable de confirmación (eliminar, desactivar, etc.). */
@Component({
  selector: 'app-confirm-modal',
  imports: [Modal, Icon],
  templateUrl: './confirm-modal.html',
})
export class ConfirmModal {
  readonly open = input(false);
  readonly title = input('Confirmar acción');
  readonly message = input('¿Estás seguro de continuar?');
  readonly confirmLabel = input('Eliminar');
  readonly closed = output<void>();
  readonly confirmed = output<void>();
}

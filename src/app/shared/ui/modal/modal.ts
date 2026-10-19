import { Component, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

export type ModalSize = 'sm' | 'md' | 'lg';

/**
 * Contenedor genérico de modales. Cada modal concreto vive en su propio archivo
 * y proyecta su cuerpo y su footer (`<div modal-footer>`) dentro de este componente.
 */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  templateUrl: './modal.html',
  host: { '(document:keydown.escape)': 'closed.emit()' },
})
export class Modal {
  readonly open = input(false);
  readonly title = input('');
  readonly size = input<ModalSize>('md');
  readonly closed = output<void>();

  protected onBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.closed.emit();
  }
}

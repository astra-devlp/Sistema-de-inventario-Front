import { Component, signal } from '@angular/core';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CategoryFormModal } from './modals/category-form-modal';

type CategoryModal = 'create' | 'edit' | 'delete' | null;

@Component({
  selector: 'app-categories-page',
  imports: [PageHeader, Icon, CategoryFormModal, ConfirmModal],
  templateUrl: './categories-page.html',
})
export class CategoriesPage {
  protected readonly placeholderRows = [1, 2, 3, 4];
  protected readonly modal = signal<CategoryModal>(null);

  protected open(modal: CategoryModal): void {
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
  }
}

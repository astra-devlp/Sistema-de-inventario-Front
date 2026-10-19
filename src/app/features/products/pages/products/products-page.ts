import { Component, signal } from '@angular/core';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { ProductDetailModal } from './modals/product-detail-modal';
import { ProductFormModal } from './modals/product-form-modal';

type ProductModal = 'create' | 'edit' | 'detail' | 'delete' | null;

@Component({
  selector: 'app-products-page',
  imports: [PageHeader, Icon, ProductFormModal, ProductDetailModal, ConfirmModal],
  templateUrl: './products-page.html',
})
export class ProductsPage {
  /** Filas de maqueta: solo estructura visual, sin datos. */
  protected readonly placeholderRows = [1, 2, 3, 4, 5];
  protected readonly modal = signal<ProductModal>(null);

  protected open(modal: ProductModal): void {
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
  }
}

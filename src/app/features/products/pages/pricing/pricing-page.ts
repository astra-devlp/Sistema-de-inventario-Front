import { Component, signal } from '@angular/core';
import { ConfirmModal } from '@shared/ui/confirm-modal/confirm-modal';
import { Icon } from '@shared/ui/icon/icon';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { PriceFormModal } from './modals/price-form-modal';
import { TaxFormModal } from './modals/tax-form-modal';

type PricingModal = 'price-create' | 'price-edit' | 'tax-create' | 'tax-edit' | 'delete' | null;

@Component({
  selector: 'app-pricing-page',
  imports: [PageHeader, Icon, PriceFormModal, TaxFormModal, ConfirmModal],
  templateUrl: './pricing-page.html',
})
export class PricingPage {
  protected readonly priceRows = [1, 2, 3, 4];
  protected readonly taxRows = [1, 2, 3];
  protected readonly modal = signal<PricingModal>(null);

  protected open(modal: PricingModal): void {
    this.modal.set(modal);
  }

  protected close(): void {
    this.modal.set(null);
  }
}

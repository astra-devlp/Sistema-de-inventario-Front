import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { formatCop } from '@core/money/money';
import { formatQuantity } from '../../../stock/quantity';
import { SaleReturn } from '../../return.model';
import { PAYMENT_LABELS } from './receipt';

const DOCUMENT_LABELS: Record<string, string> = { devolucion_interna: 'Devolución interna' };

/** Comprobante de devolución (`DEV-…`), para papel térmico de 80 mm. El emisor tolera `null` en cualquier campo. */
@Component({
  selector: 'app-return-receipt',
  imports: [DatePipe],
  templateUrl: './return-receipt.html',
})
export class ReturnReceipt {
  readonly saleReturn = input.required<SaleReturn>();

  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly labels = PAYMENT_LABELS;
  /** Colombia no tiene horario de verano: -05:00 todo el año. */
  protected readonly bogota = '-0500';

  protected readonly documentLabel = computed(() => DOCUMENT_LABELS[this.saleReturn().document_type] ?? 'Devolución interna');
  protected readonly issuer = computed(() => this.saleReturn().issuer);
  protected readonly issuerName = computed(() => this.issuer()?.legal_name || this.issuer()?.name || null);
  protected readonly issuerPlace = computed(() => [this.issuer()?.address, this.issuer()?.city].filter(Boolean).join(' · '));
}

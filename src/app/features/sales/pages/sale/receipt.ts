import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { formatCop } from '@core/money/money';
import { formatQuantity } from '../../../stock/quantity';
import { PaymentMethod } from '../../sale-math';
import { Sale } from '../../sale.model';

export const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  transferencia: 'Transferencia',
  credito: 'Crédito',
};

const DOCUMENT_LABELS: Record<string, string> = { comprobante_interno: 'Comprobante interno' };

/**
 * Comprobante de la venta, pensado para papel térmico de 80 mm (ver `styles/receipt.css`). Todo sale de la respuesta
 * del back; el encabezado tolera un `issuer` nulo o con campos nulos (recibos anteriores a la copia de datos).
 */
@Component({
  selector: 'app-receipt',
  imports: [DatePipe],
  templateUrl: './receipt.html',
})
export class Receipt {
  readonly sale = input.required<Sale>();

  protected readonly formatCop = formatCop;
  protected readonly formatQuantity = formatQuantity;
  protected readonly paymentLabels = PAYMENT_LABELS;
  /** Colombia no tiene horario de verano: -05:00 todo el año. */
  protected readonly bogota = '-0500';

  protected readonly documentLabel = computed(() => DOCUMENT_LABELS[this.sale().document_type] ?? 'Comprobante interno');
  protected readonly issuer = computed(() => this.sale().issuer);
  protected readonly issuerName = computed(() => this.issuer()?.legal_name || this.issuer()?.name || null);
  protected readonly issuerPlace = computed(() => [this.issuer()?.address, this.issuer()?.city].filter(Boolean).join(' · '));
  protected readonly voided = computed(() => this.sale().status === 'anulada' || this.sale().voided_at !== null);
}

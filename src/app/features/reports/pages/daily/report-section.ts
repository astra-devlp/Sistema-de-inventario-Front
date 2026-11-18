import { Component, input } from '@angular/core';
import { formatCop } from '@core/money/money';
import { ReportSection } from '../../daily-report.model';
import { METHODS, METHOD_LABELS } from '../../daily-report';

/** Ventas, anulaciones, devoluciones y neto de un grupo (la sede, una caja o un turno), por medio de pago. */
@Component({
  selector: 'app-report-section',
  templateUrl: './report-section.html',
})
export class ReportSectionTable {
  readonly section = input.required<ReportSection>();
  readonly caption = input('');

  protected readonly formatCop = formatCop;
  protected readonly methods = METHODS;
  protected readonly labels = METHOD_LABELS;
}

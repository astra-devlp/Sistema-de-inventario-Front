import { DatePipe } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { formatCop } from '@core/money/money';
import { differenceInfo, expectedNote } from '../../shift-rules';
import { Shift } from '../../shift.model';

/** Resultado de un turno cerrado: esperado, contado y diferencia rotulada. Solo existe después del cierre. */
@Component({
  selector: 'app-shift-result',
  imports: [DatePipe],
  templateUrl: './shift-result.html',
})
export class ShiftResult {
  readonly shift = input.required<Shift>();

  protected readonly formatCop = formatCop;
  protected readonly difference = computed(() => differenceInfo(this.shift().difference));
  protected readonly negativeNote = computed(() => expectedNote(this.shift().expected_cash));
}

import { Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { Modal } from '@shared/ui/modal/modal';
import {
  PLANS,
  PLAN_END_NOTE,
  PLAN_STATE_LABELS,
  bogotaDate,
  formatDay,
  planBody,
  planState,
  platformErrorMessage,
} from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { PlatformCompany } from '../platform.model';

/** Renovar con `PUT /platform/companies/{id}/plan`: plan y vencimiento juntos, o los dos vacíos (sin vencimiento). */
@Component({
  selector: 'app-plan-modal',
  imports: [Modal, ReactiveFormsModule],
  templateUrl: './plan-modal.html',
})
export class PlanModal {
  private readonly api = inject(PlatformApi);

  readonly open = input(false);
  readonly company = input<PlatformCompany | null>(null);
  readonly closed = output<void>();
  readonly saved = output<PlatformCompany>();

  protected readonly plans = PLANS;
  protected readonly planNote = PLAN_END_NOTE;
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = new FormGroup({
    plan: new FormControl('', { nonNullable: true }),
    expires_on: new FormControl('', { nonNullable: true }),
  });

  protected readonly current = computed(() => {
    const company = this.company();
    if (!company) return '';
    const state = PLAN_STATE_LABELS[planState(company)];
    const day = bogotaDate(company.plan_expires_at);
    return day ? `${state}: vence el ${formatDay(day)}` : state;
  });

  constructor() {
    effect(() => {
      if (!this.open()) return;
      const company = this.company();
      untracked(() => {
        this.error.set(null);
        this.form.reset({ plan: company?.plan ?? '', expires_on: bogotaDate(company?.plan_expires_at) ?? '' });
      });
    });
  }

  protected clear(): void {
    this.form.reset({ plan: '', expires_on: '' });
  }

  protected submit(): void {
    const company = this.company();
    if (!company || this.submitting()) return;
    const raw = this.form.getRawValue();
    const result = planBody(raw.plan, raw.expires_on);
    if (!result.ok) {
      this.error.set(result.error);
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.api.setPlan(company.id, result.value).subscribe({
      next: (updated) => {
        this.submitting.set(false);
        this.saved.emit(updated);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.error.set(platformErrorMessage(err, 'No se pudo actualizar el plan'));
      },
    });
  }
}

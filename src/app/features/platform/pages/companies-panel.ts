import { Component, inject, signal } from '@angular/core';
import { httpErrorMessage } from '@core/auth/auth.service';
import { Icon } from '@shared/ui/icon/icon';
import { PLAN_LABELS, PLAN_STATE_LABELS, PlanState, bogotaDate, formatDay, planState } from '../platform-rules';
import { PlatformApi } from '../platform.api';
import { PlatformCompany } from '../platform.model';
import { CompanyCreateModal } from './company-create-modal';
import { CompanyEditModal } from './company-edit-modal';
import { PlanModal } from './plan-modal';

type CompaniesModal = 'create' | 'edit' | 'plan' | null;

@Component({
  selector: 'app-companies-panel',
  imports: [Icon, CompanyCreateModal, CompanyEditModal, PlanModal],
  templateUrl: './companies-panel.html',
})
export class CompaniesPanel {
  private readonly api = inject(PlatformApi);

  protected readonly companies = signal<PlatformCompany[]>([]);
  protected readonly loading = signal(true);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly modal = signal<CompaniesModal>(null);
  protected readonly selected = signal<PlatformCompany | null>(null);

  protected readonly planLabels = PLAN_LABELS;
  protected readonly stateLabels = PLAN_STATE_LABELS;
  protected readonly formatDay = formatDay;

  constructor() {
    this.load();
  }

  protected state(company: PlatformCompany): PlanState {
    return planState(company);
  }

  protected expiry(company: PlatformCompany): string {
    return formatDay(bogotaDate(company.plan_expires_at));
  }

  protected badge(state: PlanState): string {
    return state === 'vigente' ? 'badge--success' : state === 'vencido' ? 'badge--danger' : 'badge--info';
  }

  protected openCreate(): void {
    this.selected.set(null);
    this.modal.set('create');
  }

  protected openEdit(company: PlatformCompany): void {
    this.selected.set(company);
    this.modal.set('edit');
  }

  protected openPlan(company: PlatformCompany): void {
    this.selected.set(company);
    this.modal.set('plan');
  }

  protected close(): void {
    this.modal.set(null);
    this.selected.set(null);
  }

  protected saved(message: string): void {
    this.close();
    this.notice.set(message);
    this.load();
  }

  private load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.companies().subscribe({
      next: (companies) => {
        this.companies.set(companies);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        this.error.set(httpErrorMessage(err, 'No se pudieron cargar las empresas'));
      },
    });
  }
}

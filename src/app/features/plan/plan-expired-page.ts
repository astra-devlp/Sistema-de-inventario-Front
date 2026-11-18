import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService, httpErrorMessage } from '@core/auth/auth.service';
import { Company } from '@core/company/company.model';
import { CompanyService } from '@core/company/company.service';

/** Pantalla de renovación: con el plan vencido la API solo deja ver `/users/me` y `/companies/me`. */
@Component({
  selector: 'app-plan-expired-page',
  templateUrl: './plan-expired-page.html',
})
export class PlanExpiredPage {
  private readonly auth = inject(AuthService);
  private readonly companyApi = inject(CompanyService);
  private readonly router = inject(Router);

  protected readonly company = signal<Company | null>(null);
  protected readonly checking = signal(false);
  protected readonly message = signal<string | null>(null);

  constructor() {
    this.companyApi.me().subscribe({
      next: (company) => this.company.set(company),
      // Sin los datos de contacto la pantalla sigue siendo útil.
      error: () => undefined,
    });
  }

  protected formatDate(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('es-CO');
  }

  /** Plataforma renueva sin que el usuario vuelva a iniciar sesión: basta con preguntar de nuevo. */
  protected retry(): void {
    this.checking.set(true);
    this.message.set(null);
    this.companyApi.me().subscribe({
      next: (company) => {
        this.checking.set(false);
        this.company.set(company);
        if (company.plan_expired) {
          this.message.set('El plan sigue vencido. Contacta a Astra para renovarlo.');
          return;
        }
        this.auth.setPlanExpired(false);
        void this.router.navigateByUrl(this.auth.homePath());
      },
      error: (err: unknown) => {
        this.checking.set(false);
        this.message.set(httpErrorMessage(err, 'No se pudo consultar el plan'));
      },
    });
  }

  protected logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
}

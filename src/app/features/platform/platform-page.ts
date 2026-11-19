import { Component, signal } from '@angular/core';
import { PageHeader } from '@shared/ui/page-header/page-header';
import { CompaniesPanel } from './pages/companies-panel';
import { TaxesPanel } from './pages/taxes-panel';
import { UnitsPanel } from './pages/units-panel';

type Tab = 'companies' | 'units' | 'taxes';

/**
 * Pantalla del administrador de plataforma: empresas y planes, y los catálogos globales de unidades e IVA. No
 * consulta `/companies/me` ni rutas de negocio: este rol no tiene empresa.
 */
@Component({
  selector: 'app-platform-page',
  imports: [PageHeader, CompaniesPanel, UnitsPanel, TaxesPanel],
  templateUrl: './platform-page.html',
})
export class PlatformPage {
  protected readonly tab = signal<Tab>('companies');
  protected readonly tabs: { id: Tab; label: string }[] = [
    { id: 'companies', label: 'Empresas' },
    { id: 'units', label: 'Unidades' },
    { id: 'taxes', label: 'IVA' },
  ];
}

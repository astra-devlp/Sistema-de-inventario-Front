import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '@shared/ui/page-header/page-header';

const SETTINGS_KEY = 'inventario.settings';

interface AppSettings {
  companyName: string;
  lowStockAlerts: boolean;
}

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { companyName: 'Mi negocio', lowStockAlerts: true };
    return { companyName: 'Mi negocio', lowStockAlerts: true, ...JSON.parse(raw) };
  } catch {
    return { companyName: 'Mi negocio', lowStockAlerts: true };
  }
}

@Component({
  selector: 'app-settings-page',
  imports: [PageHeader, FormsModule],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly current = readSettings();

  protected companyName = this.current.companyName;
  protected lowStockAlerts = this.current.lowStockAlerts;
  protected readonly saved = signal(false);

  protected save(): void {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        companyName: this.companyName.trim() || 'Mi negocio',
        lowStockAlerts: this.lowStockAlerts,
      }),
    );
    this.saved.set(true);
  }
}

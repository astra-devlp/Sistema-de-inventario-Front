import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '@core/auth/auth.service';
import { Icon, IconName } from '@shared/ui/icon/icon';

const SETTINGS_KEY = 'inventario.settings';
const DEVICES_KEY = 'inventario.devices';
const TICKET_KEY = 'inventario.ticketTemplate';

type DeviceId = 'barcode' | 'scale' | 'printer' | 'dian';
type PanelId = 'printer' | 'dian' | null;
type PaperWidth = '58mm' | '80mm';
type DianEnv = 'habilitacion' | 'produccion';
type TicketFont = 'small' | 'normal' | 'large';

interface AppSettings {
  companyName: string;
  lowStockAlerts: boolean;
}

interface DeviceState {
  connected: boolean;
  endpoint: string;
}

interface DevicesConfig {
  barcode: DeviceState;
  scale: DeviceState;
  printer: DeviceState & { tcpPort: string; paperWidth: PaperWidth };
  dian: DeviceState & {
    nit: string;
    softwareId: string;
    softwarePin: string;
    environment: DianEnv;
  };
}

interface TicketTemplate {
  headerExtra: string;
  footer: string;
  fontSize: TicketFont;
  showDateTime: boolean;
  showCustomer: boolean;
  showPaymentMethod: boolean;
  showChange: boolean;
  showReprintLabel: boolean;
}

interface DeviceRow {
  id: DeviceId;
  title: string;
  detail: string;
  icon: IconName;
  panel: PanelId;
}

const DEFAULT_DEVICES: DevicesConfig = {
  barcode: { connected: false, endpoint: 'USB-HID' },
  scale: { connected: false, endpoint: 'COM3' },
  printer: {
    connected: false,
    endpoint: '192.168.1.50',
    tcpPort: '9100',
    paperWidth: '80mm',
  },
  dian: {
    connected: false,
    endpoint: 'API REST',
    nit: '',
    softwareId: '',
    softwarePin: '',
    environment: 'habilitacion',
  },
};

const DEFAULT_TICKET: TicketTemplate = {
  headerExtra: '',
  footer: '¡Gracias por su compra!',
  fontSize: 'normal' as TicketFont,
  showDateTime: true,
  showCustomer: true,
  showPaymentMethod: true,
  showChange: true,
  showReprintLabel: true,
};

function readSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { companyName: 'Mi negocio', lowStockAlerts: true };
    return { companyName: 'Mi negocio', lowStockAlerts: true, ...JSON.parse(raw) };
  } catch {
    return { companyName: 'Mi negocio', lowStockAlerts: true };
  }
}

function readDevices(): DevicesConfig {
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    if (!raw) return structuredClone(DEFAULT_DEVICES);
    const parsed = JSON.parse(raw) as Partial<DevicesConfig>;
    const base = structuredClone(DEFAULT_DEVICES);
    return {
      barcode: { ...base.barcode, ...parsed.barcode },
      scale: { ...base.scale, ...parsed.scale },
      printer: { ...base.printer, ...parsed.printer },
      dian: { ...base.dian, ...parsed.dian },
    };
  } catch {
    return structuredClone(DEFAULT_DEVICES);
  }
}

function readTicket(): TicketTemplate {
  try {
    const raw = localStorage.getItem(TICKET_KEY);
    if (!raw) return { ...DEFAULT_TICKET };
    return { ...DEFAULT_TICKET, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_TICKET };
  }
}

@Component({
  selector: 'app-settings-page',
  imports: [FormsModule, RouterLink, Icon],
  templateUrl: './settings-page.html',
})
export class SettingsPage {
  private readonly auth = inject(AuthService);
  private readonly current = readSettings();

  protected readonly user = this.auth.user;
  /** Administrador de la empresa: edita la plantilla y los datos de la empresa (en Mi cuenta). */
  protected readonly isCompanyAdmin = computed(() => this.auth.isCompanyAdmin());
  /** Supervisor y Cajero solo ven la plantilla; los datos de la empresa los define el Administrador. */
  protected readonly isStaff = computed(() => this.auth.hasRole('Supervisor', 'Usuario'));
  protected readonly canEditTicket = computed(() => this.auth.isCompanyAdmin());

  protected companyName = this.current.companyName;
  protected lowStockAlerts = this.current.lowStockAlerts;

  protected readonly devices = signal(readDevices());
  protected readonly ticket = signal(readTicket());
  protected readonly openPanel = signal<PanelId>(null);
  protected readonly showPreview = signal(false);
  protected readonly saved = signal<string | null>(null);
  protected readonly testMessage = signal<string | null>(null);

  protected readonly connectedCount = computed(
    () => this.rows.filter((row) => this.devices()[row.id].connected).length,
  );

  protected readonly business = computed(() => {
    const c = this.auth.company();
    return {
      name: (c?.name ?? '').trim() || '—',
      nit: (c?.tax_id ?? '').trim() || '—',
      phone: (c?.phone ?? '').trim() || '—',
      address: (c?.address ?? '').trim() || '—',
      city: (c?.city ?? '').trim() || '—',
    };
  });

  protected readonly rows: DeviceRow[] = [
    {
      id: 'barcode',
      title: 'Lector de código de barras',
      detail: 'USB-HID',
      icon: 'barcode',
      panel: null,
    },
    {
      id: 'scale',
      title: 'Balanza digital',
      detail: 'Puerto serie',
      icon: 'ruler',
      panel: null,
    },
    {
      id: 'printer',
      title: 'Impresora de tickets',
      detail: 'Red / TCP',
      icon: 'printer',
      panel: 'printer',
    },
    {
      id: 'dian',
      title: 'DIAN Facturación electrónica',
      detail: 'API REST',
      icon: 'shield',
      panel: 'dian',
    },
  ];

  constructor() {
    // Datos al día de la empresa para la vista previa del ticket.
    this.auth.refreshPlan().subscribe();
  }

  protected device(id: DeviceId): DeviceState {
    return this.devices()[id];
  }

  protected statusLabel(id: DeviceId): string {
    return this.device(id).connected ? 'Conectado' : 'Desconectado';
  }

  protected toggleConnect(id: DeviceId): void {
    this.devices.update((current) => ({
      ...current,
      [id]: { ...current[id], connected: !current[id].connected },
    }));
    this.persistDevices();
    this.flash(
      this.device(id).connected
        ? `${this.rowTitle(id)} conectado en este equipo.`
        : `${this.rowTitle(id)} desconectado.`,
    );
  }

  protected configure(panel: PanelId): void {
    this.openPanel.update((current) => (panel != null && current === panel ? null : panel));
    this.testMessage.set(null);
    this.showPreview.set(false);
    if (panel) {
      queueMicrotask(() => {
        const el = document.getElementById(`cfg-${panel}-panel`);
        if (!el) return;
        // Solo hace scroll si el panel no cabe en la vista.
        const rect = el.getBoundingClientRect();
        const viewH = window.innerHeight || document.documentElement.clientHeight;
        if (rect.bottom > viewH - 16 || rect.top < 72) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  }

  protected patchPrinter(partial: Partial<DevicesConfig['printer']>): void {
    this.devices.update((current) => ({
      ...current,
      printer: { ...current.printer, ...partial },
    }));
  }

  protected patchTicket(partial: Partial<TicketTemplate>): void {
    if (!this.canEditTicket()) return;
    this.ticket.update((current) => ({ ...current, ...partial }));
  }

  protected patchDian(partial: Partial<DevicesConfig['dian']>): void {
    this.devices.update((current) => ({
      ...current,
      dian: { ...current.dian, ...partial },
    }));
  }

  protected saveGeneral(): void {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({
        companyName: this.companyName.trim() || 'Mi negocio',
        lowStockAlerts: this.lowStockAlerts,
      }),
    );
    this.flash('Preferencias generales guardadas en este dispositivo.');
  }

  protected saveTicketTemplate(): void {
    if (!this.canEditTicket()) return;
    const printer = this.devices().printer;
    this.devices.update((current) => ({
      ...current,
      printer: {
        ...printer,
        endpoint: printer.endpoint.trim() || DEFAULT_DEVICES.printer.endpoint,
        tcpPort: printer.tcpPort.trim() || '9100',
      },
    }));
    this.persistDevices();
    localStorage.setItem(TICKET_KEY, JSON.stringify(this.ticket()));
    this.flash('Plantilla de ticket guardada.');
  }

  protected togglePreview(): void {
    this.showPreview.update((v) => !v);
  }

  protected printTest(): void {
    const printer = this.devices().printer;
    if (!printer.connected) {
      this.testMessage.set('Conecta la impresora antes de imprimir una prueba.');
      return;
    }
    this.testMessage.set(
      `Prueba enviada a ${printer.endpoint}:${printer.tcpPort} (${printer.paperWidth}).`,
    );
  }

  protected saveDian(): void {
    this.persistDevices();
    const dian = this.devices().dian;
    this.flash(
      dian.connected
        ? 'Credenciales DIAN guardadas. Integración activa en este equipo.'
        : 'Credenciales DIAN guardadas. Conéctala para usarla en facturas.',
    );
  }

  private persistDevices(): void {
    localStorage.setItem(DEVICES_KEY, JSON.stringify(this.devices()));
  }

  private flash(message: string): void {
    this.saved.set(message);
  }

  private rowTitle(id: DeviceId): string {
    return this.rows.find((row) => row.id === id)?.title ?? id;
  }
}

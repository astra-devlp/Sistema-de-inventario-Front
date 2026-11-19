import { Injectable, signal } from '@angular/core';

export type Theme = 'dark' | 'light';

/** Misma clave que el Landing para compartir preferencia. */
const STORAGE_KEY = 'astra-theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(this.readTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'dark' ? 'light' : 'dark');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    localStorage.setItem(STORAGE_KEY, theme);
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    const root = document.documentElement;
    root.classList.toggle('dark', theme === 'dark');
    root.classList.toggle('light', theme === 'light');
    root.dataset['theme'] = theme;
  }

  private readTheme(): Theme {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    const legacy = localStorage.getItem('astra-inventario-theme');
    if (legacy === 'light' || legacy === 'dark') return legacy;
    return 'dark';
  }
}

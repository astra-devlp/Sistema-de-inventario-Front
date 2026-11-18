import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { provideRouter, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { authInterceptor } from './core/auth/auth.interceptor';
import { AuthService } from './core/auth/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withInMemoryScrolling({
        // Al cambiar de módulo, vuelve arriba; el scroll vertical solo si hay overflow.
        scrollPositionRestoration: 'top',
        anchorScrolling: 'enabled',
      }),
    ),
    provideHttpClient(
      withInterceptors([authInterceptor]),
      // Doble envío anti-CSRF: Angular copia la cookie de la API en esta cabecera
      // en cada POST/PUT/PATCH/DELETE a rutas relativas (/api/...).
      withXsrfConfiguration({ cookieName: 'inventario_csrf', headerName: 'X-CSRF-Token' }),
    ),
    // Antes de enrutar se pregunta a la API si hay sesión (cookie httpOnly).
    provideAppInitializer(() => inject(AuthService).restore()),
  ],
};

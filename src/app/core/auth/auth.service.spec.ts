import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Company } from '@core/company/company.model';
import { authInterceptor } from './auth.interceptor';
import { AuthUser, LoginResponse } from './auth.model';
import { AuthService } from './auth.service';

const user: AuthUser = {
  id: 1,
  name: 'Cajero Demo',
  email: 'cajero@demo.co',
  role: 'Usuario',
  phone: null,
  is_active: true,
  company_id: 2,
  created_at: '2026-11-18T00:00:00Z',
  updated_at: '2026-11-18T00:00:00Z',
};

const platformUser: AuthUser = { ...user, id: 9, role: 'Administrador de plataforma', company_id: null };

function company(planExpired: boolean): Company {
  return {
    id: 2,
    name: 'Empresa Demo',
    tax_id: null,
    legal_name: null,
    phone: null,
    address: null,
    city: null,
    is_active: true,
    default_tax_id: null,
    return_window_days: 30,
    plan: planExpired ? 'mensual' : null,
    plan_expires_at: null,
    plan_expired: planExpired,
  };
}

function loginResponse(u: AuthUser): LoginResponse {
  return { access_token: 'jwt-de-prueba', token_type: 'bearer', user: u };
}

describe('AuthService', () => {
  let auth: AuthService;
  let backend: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    auth = TestBed.inject(AuthService);
    backend = TestBed.inject(HttpTestingController);
  });

  afterEach(() => backend.verify());

  describe('login', () => {
    it('no guarda el token en el navegador, fija el usuario y consulta el plan', () => {
      let done = false;
      auth.login('cajero@demo.co', 'Demo-12345-abc').subscribe(() => (done = true));
      backend.expectOne('/api/users/login').flush(loginResponse(user));
      expect(sessionStorage.length + localStorage.length).toBe(0); // la sesión va en la cookie HttpOnly
      expect(auth.user()?.email).toBe('cajero@demo.co');
      backend.expectOne('/api/companies/me').flush(company(false));
      expect(done).toBe(true);
      expect(auth.planExpired()).toBe(false);
    });

    it('con el plan vencido el login funciona y el inicio pasa a ser la pantalla de renovación', () => {
      auth.login('cajero@demo.co', 'Demo-12345-abc').subscribe();
      backend.expectOne('/api/users/login').flush(loginResponse(user));
      backend.expectOne('/api/companies/me').flush(company(true));
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.planExpired()).toBe(true);
      expect(auth.homePath()).toBe('/plan-vencido');
    });

    it('el administrador de plataforma no tiene empresa: no consulta el plan', () => {
      auth.login('plataforma@astra.co', 'clave-larga-123').subscribe();
      backend.expectOne('/api/users/login').flush(loginResponse(platformUser));
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.planExpired()).toBe(false);
    });

    it('con credenciales incorrectas no deja sesión', () => {
      let message = '';
      auth.login('x@y.co', 'mala').subscribe({ error: (e) => (message = e.error.detail) });
      backend
        .expectOne('/api/users/login')
        .flush({ detail: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
      expect(message).toBe('Correo o contraseña incorrectos');
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('si falla la consulta del plan, el login no se cae', () => {
      let done = false;
      auth.login('cajero@demo.co', 'Demo-12345-abc').subscribe(() => (done = true));
      backend.expectOne('/api/users/login').flush(loginResponse(user));
      backend.expectOne('/api/companies/me').flush({}, { status: 500, statusText: 'Error' });
      expect(done).toBe(true);
      expect(auth.isLoggedIn()).toBe(true);
    });
  });

  describe('restore', () => {
    it('pregunta a la API con la cookie y recupera el usuario y el plan', async () => {
      const restored = auth.restore();
      const me = backend.expectOne('/api/users/me');
      expect(me.request.withCredentials).toBe(true);
      me.flush(user);
      backend.expectOne('/api/companies/me').flush(company(true));
      await restored;
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.planExpired()).toBe(true);
    });

    it('sin sesión (401) no deja usuario ni navega', async () => {
      const restored = auth.restore();
      backend.expectOne('/api/users/me').flush({ detail: 'No autenticado' }, { status: 401, statusText: 'Unauthorized' });
      await restored;
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('con la API caída no deja sesión, sin romper nada', async () => {
      const restored = auth.restore();
      backend.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'Error' });
      await restored;
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('borra el token que guardaban versiones anteriores', async () => {
      localStorage.setItem('inventario.token', 'viejo');
      sessionStorage.setItem('inventario.token', 'jwt-viejo');
      const restored = auth.restore();
      backend.expectOne('/api/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });
      await restored;
      expect(localStorage.getItem('inventario.token')).toBeNull();
      expect(sessionStorage.getItem('inventario.token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('pide a la API borrar las cookies y olvida el usuario', () => {
      auth.setUser(user);
      auth.logout();
      expect(auth.isLoggedIn()).toBe(false);
      const req = backend.expectOne('/api/users/logout');
      expect(req.request.method).toBe('POST');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });

    it('si el logout falla, igual queda fuera de sesión en la app', () => {
      auth.setUser(user);
      auth.logout();
      backend.expectOne('/api/users/logout').flush({}, { status: 500, statusText: 'Error' });
      expect(auth.isLoggedIn()).toBe(false);
    });
  });
});

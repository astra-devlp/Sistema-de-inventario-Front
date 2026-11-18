import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Company } from '@core/company/company.model';
import { authInterceptor } from './auth.interceptor';
import { AuthUser, LoginResponse } from './auth.model';
import { AuthService } from './auth.service';
import { readToken, saveToken } from './token-storage';

const user: AuthUser = {
  id: 1,
  name: 'Cajero Demo',
  email: 'cajero@demo.co',
  role: 'Usuario',
  phone: null,
  is_active: true,
  plan: null,
  plan_starts_at: null,
  plan_ends_at: null,
  company_id: 2,
  account_owner_id: null,
  business_name: null,
  business_nit: null,
  business_phone: null,
  business_address: null,
  business_city: null,
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
    it('guarda el token en sessionStorage, fija el usuario y consulta el plan', () => {
      let done = false;
      auth.login('cajero@demo.co', 'Demo-12345-abc').subscribe(() => (done = true));
      backend.expectOne('/api/users/login').flush(loginResponse(user));
      expect(readToken()).toBe('jwt-de-prueba');
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

    it('con credenciales incorrectas no guarda token ni deja sesión', () => {
      let message = '';
      auth.login('x@y.co', 'mala').subscribe({ error: (e) => (message = e.error.detail) });
      backend
        .expectOne('/api/users/login')
        .flush({ detail: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
      expect(message).toBe('Correo o contraseña incorrectos');
      expect(readToken()).toBeNull();
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
    it('sin token no llama a la API', async () => {
      await auth.restore();
      backend.expectNone('/api/users/me');
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('con token válido recupera el usuario y revisa el plan', async () => {
      saveToken('jwt-guardado');
      const restored = auth.restore();
      const me = backend.expectOne('/api/users/me');
      expect(me.request.headers.get('Authorization')).toBe('Bearer jwt-guardado');
      me.flush(user);
      backend.expectOne('/api/companies/me').flush(company(true));
      await restored;
      expect(auth.isLoggedIn()).toBe(true);
      expect(auth.planExpired()).toBe(true);
    });

    it('con un 401 borra el token y no deja sesión', async () => {
      saveToken('jwt-vencido');
      const restored = auth.restore();
      backend.expectOne('/api/users/me').flush({ detail: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });
      await restored;
      expect(readToken()).toBeNull();
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('con la API caída conserva el token para reintentar', async () => {
      saveToken('jwt-guardado');
      const restored = auth.restore();
      backend.expectOne('/api/users/me').flush({}, { status: 500, statusText: 'Error' });
      await restored;
      expect(readToken()).toBe('jwt-guardado');
      expect(auth.isLoggedIn()).toBe(false);
    });

    it('borra de localStorage el token de versiones anteriores', async () => {
      localStorage.setItem('inventario.token', 'viejo');
      await auth.restore();
      expect(localStorage.getItem('inventario.token')).toBeNull();
    });
  });

  describe('logout', () => {
    it('olvida el token y el usuario sin llamar a la API', () => {
      saveToken('jwt');
      auth.setUser(user);
      auth.logout();
      expect(readToken()).toBeNull();
      expect(auth.isLoggedIn()).toBe(false);
      backend.expectNone('/api/users/logout');
    });
  });
});

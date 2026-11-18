import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { SKIP_SESSION_REDIRECT } from '@core/api/http-context';
import { HttpContext } from '@angular/common/http';
import { AuthUser } from './auth.model';
import { authInterceptor } from './auth.interceptor';
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
  company_id: 1,
  account_owner_id: null,
  business_name: null,
  business_nit: null,
  business_phone: null,
  business_address: null,
  business_city: null,
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let router: Router;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'login', children: [] },
          { path: 'plan-vencido', children: [] },
        ]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    auth = TestBed.inject(AuthService);
    auth.setUser(user);
    saveToken('token-de-prueba');
  });

  afterEach(() => backend.verify());

  it('agrega Authorization: Bearer a las peticiones a la API', () => {
    http.get('/api/products').subscribe();
    const req = backend.expectOne('/api/products');
    expect(req.request.headers.get('Authorization')).toBe('Bearer token-de-prueba');
    req.flush([]);
  });

  it('no manda el token a otras URL', () => {
    http.get('https://otro-sitio.com/datos').subscribe();
    const req = backend.expectOne('https://otro-sitio.com/datos');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('no manda el token en el login', () => {
    http.post('/api/users/login', {}).subscribe({ error: () => undefined });
    const req = backend.expectOne('/api/users/login');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({ detail: 'Correo o contraseña incorrectos' }, { status: 401, statusText: 'Unauthorized' });
    expect(readToken()).toBe('token-de-prueba');
  });

  it('un 401 cierra la sesión y manda al login con aviso de sesión vencida', async () => {
    http.get('/api/products').subscribe({ error: () => undefined });
    backend.expectOne('/api/products').flush({ detail: 'Token inválido' }, { status: 401, statusText: 'Unauthorized' });
    expect(readToken()).toBeNull();
    expect(auth.isLoggedIn()).toBe(false);
    await vi.waitFor(() => expect(router.url).toBe('/login?expired=1'));
  });

  it('un 401 de una petición marcada para omitir la redirección no toca la sesión', () => {
    const context = new HttpContext().set(SKIP_SESSION_REDIRECT, true);
    http.get('/api/users/me', { context }).subscribe({ error: () => undefined });
    backend.expectOne('/api/users/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(readToken()).toBe('token-de-prueba');
    expect(auth.isLoggedIn()).toBe(true);
  });

  it('un 403 de autorización no es sesión vencida: conserva el token y no navega', () => {
    http.post('/api/sales/1/void', {}).subscribe({ error: () => undefined });
    backend
      .expectOne('/api/sales/1/void')
      .flush({ detail: 'Autorización no válida' }, { status: 403, statusText: 'Forbidden' });
    expect(readToken()).toBe('token-de-prueba');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.planExpired()).toBe(false);
    expect(router.url).toBe('/');
  });

  it('un 403 plan_vencido no cierra la sesión y lleva a la pantalla de renovación', async () => {
    http.get('/api/products').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/products')
      .flush(
        { detail: { code: 'plan_vencido', message: 'El plan de la empresa venció' } },
        { status: 403, statusText: 'Forbidden' },
      );
    expect(readToken()).toBe('token-de-prueba');
    expect(auth.isLoggedIn()).toBe(true);
    expect(auth.planExpired()).toBe(true);
    await vi.waitFor(() => expect(router.url).toBe('/plan-vencido'));
  });

  it('un 409, un 422 y un 429 pasan sin cerrar la sesión', () => {
    for (const status of [409, 422, 429]) {
      http.post('/api/sales', {}).subscribe({ error: () => undefined });
      backend.expectOne('/api/sales').flush({ detail: 'x' }, { status, statusText: 'Error' });
    }
    expect(readToken()).toBe('token-de-prueba');
    expect(auth.isLoggedIn()).toBe(true);
  });
});

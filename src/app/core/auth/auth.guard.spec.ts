import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, RouterStateSnapshot, UrlTree, provideRouter } from '@angular/router';
import { authGuard, guestGuard, planExpiredGuard, roleGuard } from './auth.guard';
import { AuthUser, UserRole } from './auth.model';
import { AuthService } from './auth.service';

function userWith(role: UserRole): AuthUser {
  return {
    id: 1,
    name: 'Demo',
    email: 'demo@demo.co',
    role,
    phone: null,
    is_active: true,
    company_id: role === 'Administrador de plataforma' ? null : 2,
    created_at: '2026-11-18T00:00:00Z',
    updated_at: '2026-11-18T00:00:00Z',
  };
}

describe('guards', () => {
  let auth: AuthService;

  /** Resultado del guard: `true` si deja pasar o la URL a la que redirige. */
  function run(guard: ReturnType<typeof roleGuard>): true | string {
    const result = TestBed.inject(EnvironmentInjector).runInContext(() =>
      guard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
    );
    return result === true ? true : (result as UrlTree).toString();
  }

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
  });

  describe('roleGuard', () => {
    it('sin sesión manda al login', () => {
      expect(run(roleGuard('Administrador'))).toBe('/login');
    });

    it('deja pasar solo a los roles indicados', () => {
      auth.setUser(userWith('Administrador'));
      expect(run(roleGuard('Administrador'))).toBe(true);
      auth.setUser(userWith('Supervisor'));
      expect(run(roleGuard('Administrador'))).toBe('/venta');
      auth.setUser(userWith('Usuario'));
      expect(run(roleGuard('Administrador'))).toBe('/venta');
    });

    it('plataforma no entra a las pantallas de empresa y vuelve a la suya', () => {
      auth.setUser(userWith('Administrador de plataforma'));
      expect(run(roleGuard('Administrador', 'Supervisor', 'Usuario'))).toBe('/plataforma');
      expect(run(roleGuard('Administrador de plataforma'))).toBe(true);
    });

    it('los roles de empresa no entran a la pantalla de plataforma', () => {
      for (const role of ['Administrador', 'Supervisor', 'Usuario'] as UserRole[]) {
        auth.setUser(userWith(role));
        expect(run(roleGuard('Administrador de plataforma'))).toBe('/venta');
      }
    });
  });

  describe('authGuard', () => {
    it('sin sesión va al login; con sesión pasa', () => {
      expect(run(authGuard)).toBe('/login');
      auth.setUser(userWith('Usuario'));
      expect(run(authGuard)).toBe(true);
    });

    it('con el plan vencido lleva a la pantalla de renovación', () => {
      auth.setUser(userWith('Usuario'));
      auth.setPlanExpired(true);
      expect(run(authGuard)).toBe('/plan-vencido');
    });
  });

  describe('planExpiredGuard', () => {
    it('solo deja entrar con sesión y plan vencido', () => {
      expect(run(planExpiredGuard)).toBe('/login');
      auth.setUser(userWith('Usuario'));
      expect(run(planExpiredGuard)).toBe('/venta');
      auth.setPlanExpired(true);
      expect(run(planExpiredGuard)).toBe(true);
    });
  });

  describe('guestGuard', () => {
    it('el login solo es para quien no tiene sesión', () => {
      expect(run(guestGuard)).toBe(true);
      auth.setUser(userWith('Administrador de plataforma'));
      expect(run(guestGuard)).toBe('/plataforma');
    });
  });
});

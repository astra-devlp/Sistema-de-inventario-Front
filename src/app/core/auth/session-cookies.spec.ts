import { CSRF_HEADER, purgeLegacyStorage, readCsrfToken } from './session-cookies';

function setCookie(value: string): void {
  document.cookie = value;
}

describe('session-cookies', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    setCookie('inventario_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
  });

  it('lee el token CSRF de su cookie y usa la cabecera que espera la API', () => {
    setCookie('otra=1; path=/');
    setCookie('inventario_csrf=abc%2B123; path=/');
    expect(readCsrfToken()).toBe('abc+123');
    expect(CSRF_HEADER).toBe('X-CSRF-Token');
  });

  it('sin la cookie no hay token CSRF', () => {
    expect(readCsrfToken()).toBeNull();
  });

  it('borra el token y el usuario que guardaban versiones anteriores', () => {
    localStorage.setItem('inventario.token', 'viejo');
    localStorage.setItem('inventario.user', '{}');
    sessionStorage.setItem('inventario.token', 'jwt-viejo');
    purgeLegacyStorage();
    expect(localStorage.getItem('inventario.token')).toBeNull();
    expect(localStorage.getItem('inventario.user')).toBeNull();
    expect(sessionStorage.getItem('inventario.token')).toBeNull();
  });

  it('no falla si el almacenamiento está bloqueado', () => {
    const blocked = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => purgeLegacyStorage()).not.toThrow();
    blocked.mockRestore();
  });
});

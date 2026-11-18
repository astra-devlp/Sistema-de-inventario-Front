import { clearToken, purgeLegacyStorage, readToken, saveToken } from './token-storage';

describe('token-storage', () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
  });

  it('guarda el token en sessionStorage y nunca en localStorage', () => {
    saveToken('abc');
    expect(readToken()).toBe('abc');
    expect(sessionStorage.getItem('inventario.token')).toBe('abc');
    expect(localStorage.length).toBe(0);
  });

  it('borra el token', () => {
    saveToken('abc');
    clearToken();
    expect(readToken()).toBeNull();
  });

  it('borra de localStorage los restos de versiones anteriores', () => {
    localStorage.setItem('inventario.token', 'viejo');
    localStorage.setItem('inventario.user', '{}');
    purgeLegacyStorage();
    expect(localStorage.getItem('inventario.token')).toBeNull();
    expect(localStorage.getItem('inventario.user')).toBeNull();
  });

  it('no falla si el almacenamiento está bloqueado', () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readToken()).toBeNull();
    blocked.mockRestore();
  });
});

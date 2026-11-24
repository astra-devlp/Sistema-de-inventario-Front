/**
 * La sesión vive en la cookie HttpOnly `inventario_session`, que pone la API en el login: el JavaScript no puede
 * leerla (un XSS no roba la sesión) y el navegador la manda sola a nuestra API (mismo sitio por el proxy `/api`).
 * La cookie `inventario_csrf` sí es legible: su valor se repite en la cabecera `X-CSRF-Token` en cada escritura,
 * algo que otra página no puede hacer (protección CSRF de doble envío).
 */
export const CSRF_COOKIE = 'inventario_csrf';
export const CSRF_HEADER = 'X-CSRF-Token';

/** Claves de versiones anteriores que guardaban el token o el usuario en el navegador. */
const LEGACY_LOCAL_KEYS = ['inventario.token', 'inventario.user'];
const LEGACY_SESSION_KEYS = ['inventario.token'];

export function readCsrfToken(): string | null {
  for (const part of document.cookie.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === CSRF_COOKIE) {
      const value = decodeURIComponent(rest.join('='));
      return value || null;
    }
  }
  return null;
}

/** Borra los tokens que dejaron las versiones anteriores (en localStorage y en sessionStorage). */
export function purgeLegacyStorage(): void {
  const remove = (storage: Storage, key: string) => {
    try {
      storage.removeItem(key);
    } catch {
      // Almacenamiento bloqueado: no hay nada que limpiar.
    }
  };
  for (const key of LEGACY_LOCAL_KEYS) remove(localStorage, key);
  for (const key of LEGACY_SESSION_KEYS) remove(sessionStorage, key);
}

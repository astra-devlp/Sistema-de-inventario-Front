/**
 * El token de acceso vive solo en sessionStorage: se pierde al cerrar la pestaña y no lo comparten
 * otras pestañas. Nunca en localStorage. Todo acceso va con try/catch porque el almacenamiento puede estar bloqueado.
 */
const TOKEN_KEY = 'inventario.token';

/** Claves de versiones anteriores que guardaban el token o el usuario en localStorage. */
const LEGACY_LOCAL_KEYS = ['inventario.token', 'inventario.user'];

export function readToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveToken(token: string): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
  } catch {
    // Almacenamiento bloqueado: la sesión dura lo que dure esta carga de la página.
  }
}

export function clearToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nada que borrar.
  }
}

/** Borra de localStorage lo que dejaron las versiones anteriores. */
export function purgeLegacyStorage(): void {
  for (const key of LEGACY_LOCAL_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // Almacenamiento bloqueado: no hay nada que limpiar.
    }
  }
}

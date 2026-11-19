/**
 * Producción: `ng build` reemplaza environment.ts por este archivo.
 * Netlify reenvía /api a la API (netlify.toml), así el front llama siempre a una ruta
 * relativa y no hay CORS. La sesión es un JWT en sessionStorage, no una cookie.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};

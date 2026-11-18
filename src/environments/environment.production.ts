/**
 * Producción: `ng build` reemplaza environment.ts por este archivo.
 * Netlify reenvía /api a la API en Render (netlify.toml), así la cookie de sesión
 * es del mismo sitio que el front.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
};

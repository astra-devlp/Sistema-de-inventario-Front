const LOCAL_API = 'http://127.0.0.1:8000';
const RENDER_API = 'https://sistema-de-inventario-back.onrender.com';

function resolveApiUrl(): string {
  if (typeof window === 'undefined') return LOCAL_API;
  const host = window.location.hostname;
  if (host === 'localhost' || host === '127.0.0.1') return LOCAL_API;
  return RENDER_API;
}

export const API_URL = resolveApiUrl();

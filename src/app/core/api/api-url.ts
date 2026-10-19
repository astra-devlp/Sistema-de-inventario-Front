const host = typeof window === 'undefined' ? '127.0.0.1' : window.location.hostname || '127.0.0.1';

export const API_URL = `http://${host}:8000`;

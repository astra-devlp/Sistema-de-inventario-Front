import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { lockedMessage, newPasswordError, normalizeCode, resetPasswordError, waitLabel } from './password-rules';

describe('password-rules', () => {
  it('valida la contraseña nueva como el back', () => {
    expect(newPasswordError('', 'Nueva-Clave-1', 'Nueva-Clave-1')).toBe('Escribe tu contraseña actual');
    expect(newPasswordError('actual', 'corta', 'corta')).toContain('al menos 8');
    expect(newPasswordError('actual', 'x'.repeat(129), 'x'.repeat(129))).toContain('máximo 128');
    expect(newPasswordError('Igual-Clave-1', 'Igual-Clave-1', 'Igual-Clave-1')).toContain('distinta');
    expect(newPasswordError('actual', 'Nueva-Clave-1', 'Otra-Clave-1')).toContain('no coincide');
    expect(newPasswordError('actual', 'Nueva-Clave-1', 'Nueva-Clave-1')).toBeNull();
  });

  it('dice cuánto esperar según Retry-After', () => {
    expect(waitLabel(30)).toBe('en unos segundos');
    expect(waitLabel(60)).toBe('en 1 minuto');
    expect(waitLabel(601)).toBe('en 11 minutos');
    expect(waitLabel(null)).toBe('en unos minutos');
  });

  it('un 429 es bloqueo por intentos; el resto usa el mensaje de siempre', () => {
    const locked = new HttpErrorResponse({ status: 429, headers: new HttpHeaders({ 'Retry-After': '300' }) });
    expect(lockedMessage(locked, 'No se pudo iniciar sesión')).toBe(
      'Demasiados intentos fallidos con este correo. Intenta de nuevo en 5 minutos.',
    );
    const wrong = new HttpErrorResponse({ status: 401, error: { detail: 'Correo o contraseña incorrectos' } });
    expect(lockedMessage(wrong, 'No se pudo iniciar sesión')).toContain('Correo o contraseña incorrectos');
  });
});

describe('recuperación', () => {
  it('el código son 6 dígitos, aunque se pegue con espacios', () => {
    expect(normalizeCode(' 123 456 ')).toBe('123456');
    expect(normalizeCode('12345')).toBeNull();
    expect(normalizeCode('12a456')).toBeNull();
  });

  it('la contraseña nueva de la recuperación sigue las reglas del back', () => {
    expect(resetPasswordError('corta', 'corta')).toContain('al menos 8');
    expect(resetPasswordError('Nueva-Clave-1', 'Otra-Clave-1')).toContain('no coincide');
    expect(resetPasswordError('Nueva-Clave-1', 'Nueva-Clave-1')).toBeNull();
  });
});

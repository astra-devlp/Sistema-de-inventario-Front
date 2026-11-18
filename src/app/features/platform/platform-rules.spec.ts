import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  CompanyCreateInput,
  bogotaDate,
  companyPatchBody,
  createCompanyBody,
  expiryAt,
  formatDay,
  normalizeNit,
  planBody,
  planState,
  platformErrorKind,
  platformErrorMessage,
  taxBody,
  unitBody,
} from './platform-rules';

// Mismos casos que `test_company_plan.py` del back.
describe('normalizeNit', () => {
  it.each([
    ['900.123.456-7', '900123456-7'],
    [' 900123456 ', '900123456'],
    ['', null],
    ['   ', null],
    ['900123456-7', '900123456-7'],
    ['123456', '123456'],
    ['1234567890', '1234567890'],
  ])('%j se guarda como %j', (given, stored) => {
    expect(normalizeNit(given)).toEqual({ ok: true, value: stored });
  });

  it('null y undefined son sin NIT', () => {
    expect(normalizeNit(null)).toEqual({ ok: true, value: null });
    expect(normalizeNit(undefined)).toEqual({ ok: true, value: null });
  });

  it.each(['1', 'ABC123456', '900123456-78', '9001234567890', '12345', '900123456-', '900-123456'])('%j es inválido', (bad) => {
    const result = normalizeNit(bad);
    expect(result.ok).toBe(false);
  });
});

describe('planBody', () => {
  it('los dos vacíos dejan la empresa sin vencimiento: ambos null', () => {
    expect(planBody('', '')).toEqual({ ok: true, value: { plan: null, plan_expires_at: null } });
  });

  it('los dos con valor envían el plan y el vencimiento con zona horaria de Bogotá', () => {
    expect(planBody('mensual', '2026-12-31')).toEqual({
      ok: true,
      value: { plan: 'mensual', plan_expires_at: '2026-12-31T23:59:59-05:00' },
    });
  });

  it('uno solo es un error: van juntos', () => {
    expect(planBody('mensual', '').ok).toBe(false);
    expect(planBody('', '2026-12-31').ok).toBe(false);
  });

  it('rechaza un plan desconocido o una fecha imposible', () => {
    expect(planBody('gratis', '2026-12-31').ok).toBe(false);
    expect(planBody('anual', '2026-02-30').ok).toBe(false);
    expect(planBody('anual', '31/12/2026').ok).toBe(false);
  });

  it('acepta un vencimiento pasado (así se prueba el bloqueo)', () => {
    expect(planBody('prueba', '2020-01-01').ok).toBe(true);
  });

  it('el vencimiento enviado cae en el mismo día de Bogotá', () => {
    expect(bogotaDate(expiryAt('2026-12-31'))).toBe('2026-12-31');
    expect(bogotaDate('2026-03-11T02:00:00Z')).toBe('2026-03-10');
    expect(bogotaDate(null)).toBeNull();
    expect(bogotaDate('no es fecha')).toBeNull();
  });
});

describe('planState', () => {
  const base = { plan: 'mensual' as const, plan_expires_at: '2026-12-31T23:59:59-05:00', plan_expired: false };

  it('vigente, vencido y sin vencimiento', () => {
    expect(planState(base)).toBe('vigente');
    expect(planState({ ...base, plan_expired: true })).toBe('vencido');
    expect(planState({ plan: null, plan_expires_at: null, plan_expired: false })).toBe('sin_vencimiento');
  });

  it('formatea el día sin corrimiento de zona', () => {
    expect(formatDay('2026-12-31')).toBe('31/12/2026');
    expect(formatDay(null)).toBe('—');
  });
});

describe('createCompanyBody', () => {
  const form: CompanyCreateInput = {
    name: ' Tienda Uno ',
    tax_id: '900.123.456-7',
    legal_name: '',
    phone: ' 3001234567 ',
    address: '',
    city: 'Armenia',
    plan: 'mensual',
    expires_on: '2026-12-31',
    admin_name: 'Ana',
    admin_email: 'ana@tienda.co',
  };

  it('arma el cuerpo con NIT normalizado, vacíos en null y plan con zona horaria', () => {
    const result = createCompanyBody(form, 'Clave-1234');
    expect(result).toEqual({
      ok: true,
      value: {
        name: 'Tienda Uno',
        tax_id: '900123456-7',
        legal_name: null,
        phone: '3001234567',
        address: null,
        city: 'Armenia',
        plan: 'mensual',
        plan_expires_at: '2026-12-31T23:59:59-05:00',
        admin_name: 'Ana',
        admin_email: 'ana@tienda.co',
        admin_password: 'Clave-1234',
      },
    });
  });

  it('exige plan y vencimiento', () => {
    expect(createCompanyBody({ ...form, plan: '' }, 'Clave-1234').ok).toBe(false);
    expect(createCompanyBody({ ...form, expires_on: '' }, 'Clave-1234').ok).toBe(false);
  });

  it('valida nombre, NIT, correo y largo de la contraseña (8 a 128)', () => {
    expect(createCompanyBody({ ...form, name: ' ' }, 'Clave-1234').ok).toBe(false);
    expect(createCompanyBody({ ...form, tax_id: '12' }, 'Clave-1234').ok).toBe(false);
    expect(createCompanyBody({ ...form, admin_email: 'sin-arroba' }, 'Clave-1234').ok).toBe(false);
    expect(createCompanyBody({ ...form, admin_name: '' }, 'Clave-1234').ok).toBe(false);
    expect(createCompanyBody(form, 'corta').ok).toBe(false);
    expect(createCompanyBody(form, 'x'.repeat(129)).ok).toBe(false);
    expect(createCompanyBody(form, 'x'.repeat(8)).ok).toBe(true);
  });

  it('los errores no repiten la contraseña', () => {
    const result = createCompanyBody({ ...form, admin_email: 'mal' }, 'Secreta-9999');
    expect(JSON.stringify(result)).not.toContain('Secreta-9999');
  });
});

describe('companyPatchBody', () => {
  it('envía los seis campos, con NIT normalizado y vacíos como null', () => {
    const result = companyPatchBody({
      name: ' Tienda ',
      tax_id: '900.123.456-7',
      legal_name: ' Astra SAS ',
      phone: '',
      address: 'Calle 1',
      city: '',
    });
    expect(result).toEqual({
      ok: true,
      value: { name: 'Tienda', tax_id: '900123456-7', legal_name: 'Astra SAS', phone: null, address: 'Calle 1', city: null },
    });
  });

  it('rechaza nombre vacío y NIT inválido', () => {
    const ok = { name: 'T', tax_id: '', legal_name: '', phone: '', address: '', city: '' };
    expect(companyPatchBody({ ...ok, name: '' }).ok).toBe(false);
    expect(companyPatchBody({ ...ok, tax_id: '9001234567890' }).ok).toBe(false);
  });
});

describe('unidades e IVA', () => {
  it('la unidad exige nombre, abreviatura y un tipo válido', () => {
    expect(unitBody(' Kilogramo ', ' kg ', 'Peso')).toEqual({ ok: true, value: { name: 'Kilogramo', abbreviation: 'kg', unit_type: 'Peso' } });
    expect(unitBody('', 'kg', 'Peso').ok).toBe(false);
    expect(unitBody('Kilo', '', 'Peso').ok).toBe(false);
    expect(unitBody('Kilo', 'kg', 'Otro').ok).toBe(false);
  });

  it('el IVA no lleva is_default y el porcentaje viaja como texto', () => {
    const result = taxBody(' IVA 19 ', '19', false);
    expect(result).toEqual({ ok: true, value: { name: 'IVA 19', rate: '19', is_exempt: false } });
    expect(Object.keys((result as { value: object }).value)).not.toContain('is_default');
  });

  it('exento es 0 sin mirar el porcentaje; acepta coma decimal', () => {
    expect(taxBody('Exento', '19', true)).toEqual({ ok: true, value: { name: 'Exento', rate: '0', is_exempt: true } });
    expect(taxBody('IVA 5,5', '5,5', false)).toEqual({ ok: true, value: { name: 'IVA 5,5', rate: '5.5', is_exempt: false } });
  });

  it('rechaza porcentajes fuera de 0 a 100 o con más de 2 decimales', () => {
    expect(taxBody('x', '101', false).ok).toBe(false);
    expect(taxBody('x', '-1', false).ok).toBe(false);
    expect(taxBody('x', '1.234', false).ok).toBe(false);
    expect(taxBody('x', '', false).ok).toBe(false);
    expect(taxBody('x', '100', false).ok).toBe(true);
    expect(taxBody('', '10', false).ok).toBe(false);
  });
});

describe('errores de plataforma', () => {
  const http = (status: number, detail?: unknown) => new HttpErrorResponse({ status, error: detail === undefined ? null : { detail } });

  it('clasifica 409, 404, 422 y 403', () => {
    expect(platformErrorKind(http(409, 'x'))).toBe('conflict');
    expect(platformErrorKind(http(404, 'x'))).toBe('not_found');
    expect(platformErrorKind(http(422, []))).toBe('validation');
    expect(platformErrorKind(http(403, 'x'))).toBe('forbidden');
    expect(platformErrorKind(http(500))).toBe('other');
    expect(platformErrorKind(new Error('x'))).toBe('other');
  });

  it('muestra el 409 de la API tal cual', () => {
    const detail =
      "No se puede cambiar el porcentaje ni la exención de la tarifa 'IVA 19': la usan 3 producto(s) y sus precios con IVA quedarían desactualizados. Crea una tarifa nueva y asígnala a esos productos.";
    expect(platformErrorMessage(http(409, detail), 'No se pudo guardar')).toBe(detail);
    expect(platformErrorMessage(http(409, 'No se puede eliminar una unidad usada por productos'), 'x')).toBe(
      'No se puede eliminar una unidad usada por productos',
    );
  });

  it('un 422 de validación nombra los campos y sin respuesta cae al texto de conexión', () => {
    const detail = [{ loc: ['body', 'plan_expires_at'], msg: 'x' }];
    expect(platformErrorMessage(http(422, detail), 'No se pudo guardar')).toContain('plan_expires_at');
    expect(platformErrorMessage(http(0), 'No se pudo guardar')).toContain('No hay conexión');
  });
});

import { Company } from '@core/company/company.model';
import { AuthUser, COMPANY_ROLES, PLATFORM_ROLE, homePathForRole, roleLabel, userContextLabel } from './auth.model';

const user: AuthUser = {
  id: 1,
  name: 'Carla Cajera',
  email: 'cajero@demo.co',
  role: 'Usuario',
  phone: null,
  is_active: true,
  company_id: 2,
  created_at: '2026-11-18T00:00:00Z',
  updated_at: '2026-11-18T00:00:00Z',
};

const company = { name: 'Empresa Demo' } as Company;

describe('roles', () => {
  it('«Usuario» se muestra como «Cajero» y los demás roles tal cual', () => {
    expect(roleLabel('Usuario')).toBe('Cajero');
    expect(roleLabel('Supervisor')).toBe('Supervisor');
    expect(roleLabel('Administrador')).toBe('Administrador');
    expect(roleLabel('Administrador de plataforma')).toBe('Administrador de plataforma');
  });

  it('los roles de empresa son tres y no incluyen el de plataforma ni «Cliente»', () => {
    expect(COMPANY_ROLES).toEqual(['Administrador', 'Supervisor', 'Usuario']);
    expect(COMPANY_ROLES).not.toContain(PLATFORM_ROLE);
    expect(COMPANY_ROLES as string[]).not.toContain('Cliente');
  });

  it('plataforma entra a su pantalla y los roles de empresa a Productos', () => {
    expect(homePathForRole('Administrador de plataforma')).toBe('/plataforma');
    for (const role of COMPANY_ROLES) expect(homePathForRole(role)).toBe('/productos');
    expect(homePathForRole(null)).toBe('/productos');
  });
});

describe('userContextLabel', () => {
  it('muestra «Empresa · Rol» con la etiqueta «Cajero»', () => {
    expect(userContextLabel(user, company)).toBe('Empresa Demo · Cajero');
    expect(userContextLabel({ ...user, role: 'Supervisor' }, company)).toBe('Empresa Demo · Supervisor');
  });

  it('sin empresa cargada muestra solo el rol, y plataforma siempre su rol', () => {
    expect(userContextLabel(user, null)).toBe('Cajero');
    expect(userContextLabel({ ...user, role: PLATFORM_ROLE, company_id: null }, null)).toBe(PLATFORM_ROLE);
    expect(userContextLabel(null, null)).toBe('—');
  });
});

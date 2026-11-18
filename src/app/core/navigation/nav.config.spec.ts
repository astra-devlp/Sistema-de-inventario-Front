import { Route } from '@angular/router';
import { UserRole } from '@core/auth/auth.model';
import { routes } from '../../app.routes';
import { NAV_GROUPS, navGroupsForRole } from './nav.config';
import { NavGroup } from './nav.model';

function ids(role: UserRole): string[] {
  return navGroupsForRole(NAV_GROUPS, role).map((group) => group.id);
}

describe('menú por rol', () => {
  it('plataforma solo ve su pantalla', () => {
    expect(ids('Administrador de plataforma')).toEqual(['platform']);
  });

  it('el Administrador de la empresa ve Productos, Clientes, Sedes y Usuarios', () => {
    expect(ids('Administrador')).toEqual(['products', 'stock', 'customers', 'locations', 'users']);
  });

  it('el Supervisor y el Cajero ven Productos, Clientes y Sedes, no Usuarios ni Plataforma', () => {
    expect(ids('Supervisor')).toEqual(['products', 'stock', 'customers', 'locations']);
    expect(ids('Usuario')).toEqual(['products', 'stock', 'customers', 'locations']);
  });

  it('sin rol no se ve ningún grupo restringido', () => {
    expect(navGroupsForRole(NAV_GROUPS, null)).toEqual([]);
  });

  it('un grupo sin roles lo ven todos', () => {
    const open: NavGroup = { id: 'abierto', label: 'Abierto', icon: 'home', items: [] };
    expect(navGroupsForRole([open], 'Usuario')).toEqual([open]);
    expect(navGroupsForRole([open], null)).toEqual([open]);
  });
});

describe('enlaces del menú', () => {
  const layout = routes.find((route) => route.component !== undefined);
  const known = new Set((layout?.children ?? []).map((route: Route) => route.path));

  it('cada enlace del menú apunta a una ruta que existe', () => {
    const paths = NAV_GROUPS.flatMap((group) => [group.path, ...group.items.map((item) => item.path)]).filter(
      (path): path is string => !!path,
    );
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) expect(known.has(path.split('/')[1]), `${path} no tiene ruta`).toBe(true);
  });

  it('las rutas de negocio y de plataforma están protegidas por rol', () => {
    for (const path of ['plataforma', 'productos', 'stock', 'clientes', 'sedes', 'usuarios']) {
      const route = layout?.children?.find((child) => child.path === path);
      expect(route?.canActivate?.length, `${path} sin guard de rol`).toBeGreaterThan(0);
    }
  });
});

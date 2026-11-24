# Sistema de inventario — front

Front Angular 22 (componentes standalone, señales, Tailwind 4) de un sistema de inventario y caja **multiempresa**:
venta con cobro en varios medios, turnos de caja, anulaciones y devoluciones, informe diario, stock, productos,
clientes, sedes y usuarios. Un Administrador de plataforma gestiona empresas, planes, unidades e IVA.

El back es otro repositorio (`Sistema-de-inventario-Back`, FastAPI) y **se usa solo como referencia**: desde aquí no se
modifica. Su contrato está en `docs/multiempresa.md` del back. Lo que el front necesita del back y aún no existe está en
[`docs/pendientes-back.md`](docs/pendientes-back.md).

## Requisitos

- Node `^22.22.3`, `^24.15.0` o `>=26` (ver `engines` en `package.json`).
- Para probar con datos: Docker y Python (para el back local).

## Levantarlo

```bash
npm install
npm start        # ng serve en http://localhost:4200
```

`ng serve` reenvía `/api/*` a `http://127.0.0.1:8000` quitando el prefijo (`proxy.conf.json`), así que el front siempre
llama a `/api/...` y no hay CORS ni URL de la API en el código (`environment.apiUrl = '/api'`).

### Back local con datos de demo

Sigue `docs/prueba-manual-caja.md` del back. En resumen, desde la raíz del back y con Docker en marcha:

```bash
docker compose -f docker-compose.test.yml up -d --wait          # Postgres local en el puerto 55432
docker exec inventario_db_test psql -U inventario -d postgres -c "CREATE DATABASE inventario_demo"
cd app
export DEMO_DATABASE_URL=postgresql+psycopg2://inventario:inventario@localhost:55432/inventario_demo
export ALEMBIC_DATABASE_URL=$DEMO_DATABASE_URL
export INITIAL_COMPANY_NAME="Empresa inicial (sin uso)"
alembic upgrade head
python -m scripts.seed_demo_caja
python -m scripts.serve_demo_caja                                # API en http://127.0.0.1:8000
```

Los scripts de demo solo se conectan a `localhost`; nunca apuntes esto a la base de producción.

### Usuarios de la demo

| Usuario | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@demo.co` | `Demo-12345-abc` |
| Supervisor | `supervisor@demo.co` | `Demo-12345-abc` |
| Cajero (rol `Usuario`) | `cajero@demo.co` | `Demo-12345-abc` |

El seed **no** crea un Administrador de plataforma (ver pendientes del back). Para probar `/plataforma` créalo con
`scripts/bootstrap_platform.py` del back contra la base de demo (`PLATFORM_ADMIN_EMAIL`, `PLATFORM_ADMIN_PASSWORD` de al
menos 12 caracteres) o inserta el usuario en esa base.

## Comandos

```bash
npm start                    # servidor de desarrollo
npm test                     # Vitest (ng test); en una sola pasada: npx ng test --watch=false
npx ng build                 # compilación de producción
npm run build                # ng build + scripts/copy-publish.mjs (lo que usa Netlify)
```

## Estructura

```
src/app/
  core/        sesión (auth), cliente HTTP y errores (api), empresa, dinero (money), navegación, layout, tema
  shared/ui/   componentes comunes: modal, confirmación, icono, cabecera de página…
  features/
    auth/        login
    plan/        pantalla «plan vencido» y reintento
    sales/       venta, cobro, comprobante 80 mm, anular y devolver, cobro pendiente
    cash-shift/  turnos de caja
    reports/     informe diario
    stock/       existencias y movimientos
    products/    productos, categorías, precios e IVA (solo lectura), unidades (solo lectura) y presentaciones
    customers/   clientes
    locations/   sedes y cajas
    users/       usuarios de la empresa y sus sedes
    account/     mi cuenta
    settings/    configuración (dispositivos, ticket, IVA por defecto)
    platform/    Administrador de plataforma: empresas y planes, unidades e IVA globales
```

Alias de importación: `@core/*`, `@features/*`, `@shared/*`. Cada feature agrupa su `*.api.ts`, `*.model.ts`, las reglas
puras (`*-rules.ts`) con su `.spec.ts`, sus rutas y su entrada de navegación.

## Reglas del proyecto (resumen de `AGENTS.md`)

1. Commits en español y sin línea de coautor.
2. Se trabaja por etapas; cada una termina con resumen y cómo probarla, y la siguiente espera aprobación.
3. No se toca el back: si el contrato no cuadra se anota en `docs/pendientes-back.md`.
4. Vocabulario del back: el rol `Usuario` se muestra como «Cajero» (viaja `Usuario`); no existe el rol «Cliente»;
   `Administrador` es el de la empresa y `Administrador de plataforma` el de la plataforma.
5. **Solo el 401 cierra sesión.** Un 403 `plan_vencido` lleva a `/plan-vencido`; cualquier otro 403, 404, 409, 422 o 429
   se muestra donde ocurrió.
6. Cantidades y montos del back son cadenas decimales (`"12.500"`, `"50000.00"`): nunca se suman como `number`.
7. Cada etapa se prueba contra el back local con los usuarios de la demo.
8. La lógica crítica (sesión, errores de la API, dinero, idempotencia) lleva prueba Vitest antes de commitear.
9. Las credenciales de autorización de un supervisor (anular, devolver) se piden en el momento y nunca se guardan.
10. No se despliega ni se toca `netlify.toml`.

## Sesión

La sesión va en la cookie HttpOnly `inventario_session` que pone la API en el login: el front nunca ve ni guarda
el token (un XSS no puede robarlo). `authInterceptor` manda las peticiones a nuestra API con `withCredentials` y, en
las escrituras, repite el valor de la cookie `inventario_csrf` en la cabecera `X-CSRF-Token` (protección CSRF de
doble envío). Funciona porque el front llega a la API por el mismo sitio (proxy `/api`). El logout llama a
`POST /users/logout`, que borra las cookies. Ver `src/app/core/auth/session-cookies.ts`.

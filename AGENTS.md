# Sistema de inventario — front (guía para agentes y colaboradores)

Front Angular (componentes standalone, señales, Tailwind) de un sistema de inventario y caja **multiempresa**.
El back vive en otro repositorio (`Sistema-de-inventario-Back`) y **no se modifica desde aquí**: es solo referencia.
Su contrato está en `docs/multiempresa.md` del back, sección «pendiente del front» incluida.

## Reglas

1. **Commits en español y sin línea de coautor** (nada de `Co-Authored-By`).
2. **Una etapa a la vez.** No empieces la siguiente sin que Jilmar apruebe la anterior. Cada etapa termina con un
   resumen y con cómo probarla.
3. **No toques el back.** Si algo del contrato no cuadra, repórtalo; no lo arregles allá.
4. **Vocabulario del back.** El rol `Usuario` se muestra como «Cajero» (solo etiqueta; el valor que viaja es `Usuario`).
   No existe el rol «Cliente»: un cliente final es un registro de `customers`. `Administrador` es el de la empresa;
   el de plataforma es `Administrador de plataforma`.
5. **Solo el 401 cierra sesión.** Un 403 nunca lo hace: `detail.code === 'plan_vencido'` lleva a la pantalla de
   renovación y cualquier otro 403 (rol, autorización no válida) se muestra donde ocurrió.
6. **Cantidades y montos del back son cadenas decimales** (`"12.500"`, `"50000.00"`): no las trates como enteros ni
   sumes dinero con `number`.
7. **Cada etapa se prueba contra el back local** con los usuarios de la demo antes de darla por terminada.
8. **Pruebas unitarias de la lógica crítica con Vitest** (`npm test`): sesión, errores de la API, dinero e
   idempotencia llevan prueba antes de commitear.
9. **Las credenciales de autorización nunca se guardan.** Las de un supervisor (anular, devolver) se piden en el
   momento, no van a ningún almacenamiento ni a una señal que viva más que el diálogo, y se borran al terminar.
10. **No despliegues ni toques `netlify.toml`.**

## Sesión

La sesión va en la cookie HttpOnly `inventario_session` que pone la API en el login: el front nunca ve ni guarda
el token (un XSS no puede robarlo). `authInterceptor` manda las peticiones a nuestra API con `withCredentials` y, en
las escrituras, repite el valor de la cookie `inventario_csrf` en la cabecera `X-CSRF-Token` (protección CSRF de
doble envío). Funciona porque el front llega a la API por el mismo sitio (proxy `/api`). El logout llama a
`POST /users/logout`, que borra las cookies. Ver `src/app/core/auth/session-cookies.ts`.
**Nunca** guardes el token en `sessionStorage` ni `localStorage`, ni quites la cabecera CSRF. Las rutas de errores
están en `src/app/core/api/`.

## Probar contra el back local

Back en `http://127.0.0.1:8000` (el proxy de `ng serve` reenvía `/api` ahí; ver `proxy.conf.json`). Para levantarlo
con datos de demo, sigue `docs/prueba-manual-caja.md` del back (Postgres en Docker, `seed_demo_caja`, `serve_demo_caja`).

| Usuario | Correo | Contraseña |
| --- | --- | --- |
| Administrador | `admin@demo.co` | `Demo-12345-abc` |
| Supervisor | `supervisor@demo.co` | `Demo-12345-abc` |
| Cajero (`Usuario`) | `cajero@demo.co` | `Demo-12345-abc` |

```bash
npm start       # ng serve en http://localhost:4200
npm test        # Vitest (ng test)
npm run build
```

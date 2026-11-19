# Pendientes del back

Cosas que el front necesita o que no cuadran con el contrato. El back es solo referencia desde este repositorio:
aquí se anotan, no se arreglan. Ordenados por prioridad (1 = más urgente).

## Prioridad alta

### 1. Endpoint para cambiar la propia contraseña

Hoy `PATCH /users/{id}` exige el rol `Administrador` (`require_admin`), así que un Supervisor o un Cajero no puede
cambiar su contraseña ni sus datos de perfil. En «Mi cuenta» quedan en solo lectura.

Hace falta algo como `POST /users/me/password` (o `PATCH /users/me`) que:

- acepte a cualquier usuario autenticado, también con el plan vencido (el perfil ya se consulta así);
- pida la contraseña actual y la nueva;
- no permita cambiar rol, correo ni `is_active`.

### 2. Un Cajero puede registrar entradas de stock

`POST /stock/entries` lo acepta de cualquier usuario de la empresa, incluido el rol `Usuario` (Cajero). Decidir si
debe ser solo `Administrador` y `Supervisor`. Mientras tanto el front ofrece «Entrada» a los tres roles, tal como
dice el contrato.

### 3. El stock no se restringe por sede asignada

Solo la caja usa las sedes asignadas (`PUT /users/{id}/locations`). `GET /stock` y los movimientos devuelven todas
las sedes a cualquier usuario de la empresa. La pantalla de stock limita el selector a las sedes asignadas
(Administrador: todas), pero es una restricción de pantalla: la API no la impone.

## Prioridad media

### 4. El turno debería traer el nombre del cajero

`ShiftResponseSchema` solo trae `user_id` y `closed_by_user_id`. Un Supervisor que no puede listar usuarios ve «Usuario
#id» en la lista de turnos. Convendría incluir el nombre del dueño y de quien cerró (`user_name`, `closed_by_name`).

### 5. El seed de demo debería crear un administrador de plataforma

`seed_demo_caja` crea una empresa y tres usuarios (`admin@demo.co`, `supervisor@demo.co`, `cajero@demo.co`), pero
ningún `Administrador de plataforma`. Sin él no se puede probar `/plataforma` ni los endpoints `/platform/*` contra la
base de demo.

`bootstrap_platform` no sirve para esto: por defecto apunta a la base del `.env` (Supabase). Lo ideal es que el
seed de demo cree el usuario en la misma base de demo, por ejemplo `plataforma@demo.co` con contraseña de demo.

## Prioridad baja

### 6. Clientes no se pueden desactivar

`DELETE /customers/{id}` responde 409 cuando el cliente tiene ventas, pero el cliente no tiene `is_active` ni
otro modo de «desactivarlo»; solo se puede conservar. Usuarios y productos sí tienen `is_active`. Si se quiere
ofrecer «desactivar» también en clientes, hace falta ese campo.

## No verificado

Funciona según el contrato y las pruebas unitarias, pero **no se ha comprobado de punta a punta** (por falta de
hardware o de datos de prueba). Verificar antes de dar por buenos:

- **Impresión en térmica real.** El comprobante de venta y el DEV de devolución se diseñaron para 80 mm y se vieron en
  pantalla y en la vista de impresión del navegador, pero no en una impresora térmica física.
- **Lector de códigos físico.** La búsqueda y el escaneo se probaron tecleando el código; falta probar con un lector
  real (velocidad de las teclas, sufijo Enter, distintas simbologías).
- **El 409 de anular con turno cerrado.** El front muestra el detalle del 409 tal cual, pero no se provocó esa respuesta
  contra el back (anular una venta cuyo turno ya está cerrado).
- **Cierre forzado del Administrador sobre otra sede.** El cierre de un turno ajeno por el Administrador no se probó
  contra una sede distinta de la suya.
- **Paginación de más de 100 turnos.** Los listados de turnos piden páginas, pero la demo nunca tuvo más de 100; no se
  comprobó el paso a la segunda página ni el límite.

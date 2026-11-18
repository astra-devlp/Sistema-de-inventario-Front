# Pendientes del back

Cosas que el front necesita o que no cuadran con el contrato. El back es solo referencia desde este repositorio:
aquí se anotan, no se arreglan.

## 1. Endpoint para cambiar la propia contraseña

Hoy `PATCH /users/{id}` exige el rol `Administrador` (`require_admin`), así que un Supervisor o un Cajero no puede
cambiar su contraseña ni sus datos de perfil. En «Mi cuenta» quedan en solo lectura.

Hace falta algo como `POST /users/me/password` (o `PATCH /users/me`) que:

- acepte a cualquier usuario autenticado, también con el plan vencido (el perfil ya se consulta así);
- pida la contraseña actual y la nueva;
- no permita cambiar rol, correo ni `is_active`.

## 2. El seed de demo debería crear un administrador de plataforma

`seed_demo_caja` crea una empresa y tres usuarios (`admin@demo.co`, `supervisor@demo.co`, `cajero@demo.co`), pero
ningún `Administrador de plataforma`. Sin él no se puede probar la pantalla de plataforma (etapa 3) ni los
endpoints `/platform/*` contra la base de demo.

`bootstrap_platform` no sirve para esto: por defecto apunta a la base del `.env` (Supabase). Lo ideal es que el
seed de demo cree el usuario en la misma base de demo, por ejemplo `plataforma@demo.co` con contraseña de demo.

## 3. Clientes no se pueden desactivar

`DELETE /customers/{id}` responde 409 cuando el cliente tiene ventas, pero el cliente no tiene `is_active` ni
otro modo de «desactivarlo»; solo se puede conservar. Usuarios y productos sí tienen `is_active`. Si se quiere
ofrecer «desactivar» también en clientes, hace falta ese campo.

## 4. Un Cajero puede registrar entradas de stock

`POST /stock/entries` lo acepta de cualquier usuario de la empresa, incluido el rol `Usuario` (Cajero). Decidir si
debe ser solo `Administrador` y `Supervisor`. Mientras tanto el front ofrece «Entrada» a los tres roles, tal como
dice el contrato.

## 5. El stock no se restringe por sede asignada

Solo la caja usa las sedes asignadas (`PUT /users/{id}/locations`). `GET /stock` y los movimientos devuelven todas
las sedes a cualquier usuario de la empresa. La pantalla de stock limita el selector a las sedes asignadas
(Administrador: todas), pero es una restricción de pantalla: la API no la impone.

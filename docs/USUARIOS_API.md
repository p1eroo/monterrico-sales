# API de usuarios (Nest + PostgreSQL)

Documentación de rutas bajo `/users`, alineadas con el modal de roles (`r1`–`r4`) y el campo `role` persistido para JWT y permisos.

## Autenticación

Todas las rutas exigen header:

```http
Authorization: Bearer <accessToken>
```

(`login` / `register` son públicos; el resto del API usa el guard JWT global.)

## Valores de `role` en base de datos

| `roleId` (modal / API) | `role` guardado | Notas |
|------------------------|-----------------|--------|
| `r1` | `admin` | |
| `r2` | `supervisor` | Registros antiguos con `gerente` se tratan como `r2` al listar (`roleId` inferido). |
| `r3` | `asesor` | |
| `r4` | `solo_lectura` | |

El JWT incluye el string `role` tal cual está en la fila del usuario.

## GET /users

Lista usuarios **sin** `passwordHash`.

- Cualquier usuario autenticado puede llamar (según política actual del proyecto).
- Cada elemento incluye `roleId` resuelto: si en BD es `null`, se infiere desde `role`.

## GET /users/:id

Detalle de un usuario. **404** si no existe.

## POST /users

Crear usuario (contraseña hasheada con bcrypt, mismas rondas que `auth`).

**Quién puede:** solo **`admin`** (403 en caso contrario).

**Body (JSON):**

| Campo | Tipo | Obligatorio | Descripción |
|-------|------|-------------|-------------|
| `username` | string | sí | Se normaliza a minúsculas y trim. |
| `name` | string | sí | |
| `password` | string | sí | Mínimo 6 caracteres. |
| `roleId` | string | sí | `r1`, `r2`, `r3` o `r4`. |
| `status` | boolean | no | `true` (default) = activo, `false` = inactivo. |

**Errores frecuentes:** 409 si `username` ya existe; 400 validación; 403 si no eres admin.

### Ejemplo curl

```bash
curl -s -X POST http://localhost:3000/users \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"username":"jperez","name":"Juan Pérez","password":"secreto12","roleId":"r3","status":true}'
```

## PATCH /users/:id

Actualización parcial. **No** cambia contraseña (usar `POST /auth/change-password` para la propia cuenta).

**Quién puede:** solo **`admin`**.

**Body (JSON):** al menos uno de los campos:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `name` | string | Nombre completo (no vacío). |
| `roleId` | string | `r1`–`r4`; actualiza también `role` en BD. |
| `status` | boolean | `true` = activo, `false` = inactivo (baja lógica). |

**Errores:** 404 usuario; 400 si el body no trae ningún campo actualizable; 403 si no eres admin.

### Ejemplo: desactivar

```bash
curl -s -X PATCH http://localhost:3000/users/ID_CUID \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":false}'
```

## Frontend relacionado

| Área | Archivo / notas |
|------|------------------|
| Mapeo `roleId` ↔ tipo CRM | `frontend/src/lib/userRoleMap.ts` |
| Lista, crear, editar, activar/desactivar | `frontend/src/pages/Users.tsx` |
| Detalle + edición | `frontend/src/pages/UserDetail.tsx` |
| Modal formulario | `frontend/src/components/users/UserFormModal.tsx` |
| Permisos UI según `role` del token | `frontend/src/data/rbac.ts` (`roleStringToTemplateId`) |

## Implementación backend (referencia)

- Controlador: `backend/src/users/users.controller.ts`
- Servicio: `backend/src/users/users.service.ts`
- DTOs: `create-user.dto.ts`, `update-user.dto.ts`
- Rondas bcrypt: `BCRYPT_ROUNDS` en `backend/src/auth/auth.constants.ts` (compartido con `AuthService`)

## Siguientes pasos sugeridos

- Swagger/OpenAPI cuando lo retoméis.
- Endpoint de reset de contraseña por admin (opcional, distinto a “ver” la contraseña).
- Ajustar `GET /users` si en el futuro solo ciertos roles deben listar el directorio completo.

# Autenticación y llamadas a la API (resumen de integración)

Este documento describe los pasos implementados para JWT, cliente HTTP, logout, permisos, datos reales y registro.

## Paso 1 — Proteger el backend con JWT

**Archivos nuevos**

- `backend/src/auth/auth.constants.ts` — `JWT_SECRET` centralizado (mismo valor que usa la firma del token). Evita duplicar el secreto en varios sitios.
- `backend/src/auth/decorators/public.decorator.ts` — `@Public()` marca rutas que **no** exigen `Authorization: Bearer <token>`.
- `backend/src/auth/strategies/jwt.strategy.ts` — Lee el Bearer, verifica la firma con `JWT_SECRET` y expone `userId`, `username`, `name`, `role` al request.
- `backend/src/auth/guards/jwt-auth.guard.ts` — Guard global: si la ruta no es `@Public()`, exige JWT válido.

**Archivos modificados**

- `auth.module.ts` — `PassportModule`, `JwtStrategy`, `JWT_SECRET` en `JwtModule.register`.
- `app.module.ts` — `APP_GUARD` con `JwtAuthGuard` (todas las rutas protegidas por defecto).
- `auth.controller.ts` — `@Public()` solo en `login` y `register`; `change-password` exige JWT.
- `app.controller.ts` — `@Public()` en `GET /` (health básico).

**Significado:** Sin token, `GET /users` (y el resto) responde 401. Con token emitido en login/register, el acceso está permitido.

---

## Paso 2 — Cliente `api()` en el frontend

**Archivo:** `frontend/src/lib/api.ts`

- Añade `Authorization: Bearer` usando `localStorage.accessToken`.
- Usa `VITE_API_URL` o `http://localhost:3000`.
- Parsea JSON y lanza `Error` con mensaje claro si la respuesta no es OK.

**Significado:** Todas las peticiones autenticadas pueden usar `api('/ruta')` en lugar de `fetch` manual.

---

## Paso 3 — Logout y sesión persistida

**Archivo:** `frontend/src/store/index.ts`

- `logout` elimina `accessToken` de `localStorage`.
- `partialize` de Zustand persist ahora incluye `isAuthenticated` para mantener sesión tras recargar (junto al token).

**Archivo:** `frontend/src/App.tsx` — `ProtectedRoute` acepta sesión si `isAuthenticated` **o** hay `accessToken` (por si el estado y el token se desincronizan brevemente).

**Significado:** Cerrar sesión limpia credenciales; recargar la página puede mantener la sesión si el persist lo guardó.

---

## Paso 4 — CORS

**Archivo:** `backend/src/main.ts` — ya tenías `enableCors({ origin: true, credentials: true })`.

**Significado:** El navegador puede llamar al API desde otro origen (p. ej. Vite en `:5173`). En producción conviene restringir `origin` a dominios conocidos.

---

## Paso 5 — Permisos según rol real

**Archivos:** `frontend/src/data/rbac.ts` (`roleStringToTemplateId`), `frontend/src/hooks/usePermissions.ts`

- Se deja de usar el mock `currentUser.id === 'u1'`.
- El rol del usuario (`admin`, `asesor`, etc.) se mapea a plantillas existentes y se usan `getTemplatePermissions`.

**Significado:** Un usuario con rol `admin` en la API recibe permisos de administrador en el CRM (según tu matriz RBAC).

---

## Paso 6 — Datos reales (usuarios)

**Archivo:** `frontend/src/pages/Users.tsx`

- La pestaña **Usuarios** carga la tabla principal desde **`GET /users`** (JWT).
- Crear / editar / activar-desactivar usan **`POST /users`** y **`PATCH /users/:id`** (detalle en [USUARIOS_API.md](./USUARIOS_API.md)).

**Significado:** Patrón replicable en contactos, empresas, etc.

---

## Paso 7 — Pantalla de registro

**Archivos:** `frontend/src/pages/Register.tsx`, rutas en `App.tsx`, enlace en `Login.tsx`.

- `POST /auth/register` con username, password, name, role opcional.
- Sigue las reglas del backend (primer usuario o `ALLOW_OPEN_REGISTRATION=true`).

**Significado:** Registro desde UI en desarrollo; en producción suele desactivarse el registro abierto.

---

## Paso 8 — CRUD usuarios (admin) y roles en BD

Resumen; detalle y ejemplos curl en **[USUARIOS_API.md](./USUARIOS_API.md)**.

**Backend**

- `POST /users` y `PATCH /users/:id`: solo rol **`admin`** en el JWT (403 para el resto).
- `roleId` del modal → `role` en PostgreSQL: `r1`→`admin`, `r2`→`supervisor`, `r3`→`asesor`, `r4`→`solo_lectura`.
- Baja lógica: `PATCH` con `status: false` (inactivo), sin borrado físico obligatorio.

**Frontend**

- `UserFormModal`: contraseña obligatoria al crear; cierre solo tras éxito del `POST`.
- `Users.tsx`: tabla desde `GET /users`; edición y toggle estado vía `PATCH`.
- `UserDetail.tsx`: carga `GET /users/:id`, edición y estado con `PATCH`.
- `Team.tsx`: alta con `POST /users` (mismas reglas de permisos en servidor).

---

## Paso 9 — Cambio de contraseña (usuario autenticado)

**Backend**

- `POST /auth/change-password` (JWT obligatorio; la ruta **no** es `@Public()`).
- Cuerpo: `currentPassword`, `newPassword` (mín. 6 caracteres, distinta de la actual).

**Frontend**

- Pestaña **Seguridad** en `Profile.tsx`: formulario que llama a `api('/auth/change-password', ...)`.

---

## Variables de entorno

- **Backend:** `JWT_SECRET`, `DATABASE_URL`, opcional `ALLOW_OPEN_REGISTRATION`.
- **Frontend:** opcional `VITE_API_URL` (ver `.env.example`).

---

## Índice en `docs/`

Ver [README.md](./README.md) en esta carpeta.

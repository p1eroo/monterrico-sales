# Autenticación local

- **User**: perfil (name, roleId, status, etc.). Sin username ni password.
- **Account**: credenciales por método de login. Un usuario puede tener varios (p. ej. `credentials` + Google).
  - `provider`: `"credentials"` (usuario/contraseña), `"google"`, etc.
  - `providerId`: username para credentials; ID de OAuth para otros.
  - `passwordHash`: solo para provider `credentials` (bcrypt).
- El **username** se obtiene de `Account.providerId` cuando `provider='credentials'` (usado en JWT y API).

## Migración

```bash
npx prisma migrate deploy
# o en desarrollo:
npx prisma migrate dev
```

## Primer usuario

Mientras no exista ningún usuario, **`POST /auth/register`** está permitido.

```bash
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"tuClaveSegura","name":"Administrador","role":"admin"}'
```

## Login

`POST /auth/login`:

```json
{ "username": "admin", "password": "..." }
```

## Más usuarios

- `ALLOW_OPEN_REGISTRATION=true` en `.env` permite seguir usando `/auth/register` con usuarios ya existentes (solo desarrollo).
- Sin eso, con usuarios en BD, el registro público responde **403**.
- En producción, los usuarios adicionales se crean con **`POST /users`** (JWT de **`admin` únicamente**): ver [USUARIOS_API.md](./USUARIOS_API.md).

## Cambiar contraseña

`POST /auth/change-password` con header `Authorization: Bearer <token>`:

```json
{ "currentPassword": "...", "newPassword": "..." }
```

La nueva contraseña debe tener al menos 6 caracteres y ser distinta de la actual.

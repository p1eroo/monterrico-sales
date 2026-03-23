# Autenticación local

- Los usuarios están en la tabla `User` (PostgreSQL) con `username`, `name`, `role` y `passwordHash` (bcrypt). **No** se usa correo en el modelo de usuario.

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

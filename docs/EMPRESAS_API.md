# API de empresas (`/companies`)

CRUD conectado a Prisma (`Company`). Requiere **JWT** en todas las rutas (guard global).

## Modelo (PostgreSQL)

Campos principales: `name`, `razonSocial`, `ruc`, `domain`, `rubro`, `tipo`, `linkedin`, `correo`, ubicación (`distrito`, `provincia`, `departamento`, `direccion`), `createdAt`, `updatedAt`.

Las relaciones con contactos u oportunidades usan tablas puente (`CompanyContact`, etc.); este documento solo cubre la entidad **Company**.

## GET /companies

Lista todas las empresas, ordenadas por `updatedAt` descendente.

## GET /companies/:id

Detalle por **id** (cuid). **404** si no existe.

## POST /companies

**Body (JSON)** — obligatorio solo `name`:

| Campo | Obligatorio | Descripción |
|--------|-------------|-------------|
| `name` | sí | Nombre comercial / razón social de uso principal |
| `razonSocial`, `ruc`, `domain`, `rubro`, `tipo`, `linkedin`, `correo`, `distrito`, `provincia`, `departamento`, `direccion` | no | Strings opcionales |

**400** si `name` vacío.

### Ejemplo

```bash
curl -s -X POST http://localhost:3000/companies \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Acme SAC","ruc":"20123456789","domain":"acme.com","rubro":"energia_mineria","tipo":"A"}'
```

## PATCH /companies/:id

Actualización parcial. Al menos un campo enviado debe estar presente (no vacío el objeto lógico).

- Si se envía `name`, no puede quedar vacío.
- Cualquier campo omitido no se modifica.

**400** si no hay nada que actualizar. **404** si el id no existe.

## DELETE /companies/:id

Elimina la fila. Las filas en tablas puente con `onDelete: Cascade` se eliminan según el esquema Prisma.

## Frontend

| Uso | Archivo |
|-----|---------|
| Listado + fusión con contactos mock | `frontend/src/pages/Empresas.tsx` |
| Detalle por **cuid** o por **nombre** (slug) | `frontend/src/pages/EmpresaDetail.tsx` |
| Tipo / helper de ruta | `frontend/src/lib/companyApi.ts` |
| Alta desde asistente | `POST` tras validar el wizard (`NewCompanyWizard`) |

### Rutas de detalle

- **Id de servidor** (cuid, p. ej. empresas solo en BD): `/empresas/<id>` con `encodeURIComponent(id)`.
- **Nombre** (empresas inferidas solo desde contactos): `/empresas/<encodeURIComponent(nombre)>` como antes.

La detección de cuid usa `isLikelyCompanyCuid()` en `companyApi.ts` (heurística por longitud y prefijo `c`).

## Backend (referencia)

- `backend/src/companies/companies.controller.ts`
- `backend/src/companies/companies.service.ts`
- DTOs: `create-company.dto.ts`, `update-company.dto.ts`

## Siguientes pasos sugeridos

- Restringir `POST`/`PATCH`/`DELETE` por rol (p. ej. solo `admin` / `supervisor`).
- Vincular contactos reales con `Company` al crear/editar contactos (tabla `CompanyContact`).
- Swagger/OpenAPI.

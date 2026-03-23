# API de contactos (`/contacts`)

CRUD conectado a Prisma (`Contact`). Requiere **JWT** en todas las rutas (guard global).

## Modelo (PostgreSQL)

Campos principales: `name`, `phone`, `email`, `source`, `etapa` (default `lead`), `assignedTo` (FK opcional a `User`), `estimatedValue`, `nextAction`, `nextFollowUp`, `notes`, `tags[]`, documento y ubicación (`docType`, `docNumber`, `departamento`, `provincia`, `distrito`, `direccion`), `clienteRecuperado`, `etapaHistory` (JSON), `createdAt`, `updatedAt`.

Al **crear**, opcionalmente:

- **`companyId`**: crea fila en `CompanyContact` con `isPrimary: true` (la empresa debe existir).

## GET /contacts

Lista contactos con `updatedAt` descendente. Incluye empresas vinculadas (`CompanyContact` + `Company`) y usuario asignado (`id`, `name`).

## GET /contacts/:id

Detalle por **cuid**. Incluye:

- empresas vinculadas,
- contactos vinculados (`ContactContact` en ambas direcciones),
- oportunidades vinculadas (`ContactOpportunity` + datos de la oportunidad),
- usuario asignado.

**404** si no existe.

## POST /contacts

**Body (JSON)** — obligatorios: `name`, `phone`, `email`, `source`.

| Campo | Obligatorio | Notas |
|--------|-------------|--------|
| `name`, `phone`, `email`, `source` | sí | `source` string (ej. `base`, `referido`) |
| `etapa` | no | Default `lead` en BD |
| `assignedTo` | no | Id de `User` existente |
| `estimatedValue` | no | Default 0 |
| `nextAction` | no | Default `Contactar` |
| `nextFollowUp` | no | ISO date string |
| `notes`, `tags`, `docType`, `docNumber`, ubicación, `clienteRecuperado` | no | |
| `etapaHistory` | no | JSON; si se omite, el servicio inicializa `[{ etapa, fecha: hoy }]` |
| `companyId` | no | Empresa existente; vínculo principal |

**400** si faltan obligatorios, usuario/empresa inexistente o fecha inválida.

## PATCH /contacts/:id

Actualización parcial. **`companyId` no se acepta** (no mezclar alta con actualización de vínculos; usar endpoints dedicados más adelante).

`nextFollowUp` puede enviarse vacío o `null` para limpiar. `etapaHistory` puede enviarse como JSON (p. ej. al cambiar etapa desde el frontend se puede reenviar el historial ampliado).

**400** si no hay campos que actualizar.

## DELETE /contacts/:id

Elimina el contacto; relaciones con `onDelete: Cascade` se limpian según el esquema.

## Frontend

| Uso | Archivo |
|-----|---------|
| Listado API + mock | `frontend/src/pages/Contactos.tsx` |
| Detalle por **cuid** o id mock | `frontend/src/pages/ContactoDetail.tsx` |
| Tipos / mapeo | `frontend/src/lib/contactApi.ts` |
| Selector de contacto en nueva oportunidad | `frontend/src/pages/Opportunities.tsx` (merge con API) |

### Alta desde el wizard

1. Si el usuario eligió **«Crear nueva empresa»** y completó el asistente de empresa embebido (`NewCompanyWizard`), el front guarda los datos en memoria y, al enviar el contacto, ejecuta en orden: **`POST /companies`** (cuerpo completo del wizard) → **`POST /contacts`** con `companyId` del resultado → si en el wizard de empresa hay **nombre de negocio**, **`POST /opportunities`** con `contactId`, `companyId`, monto/etapa/fecha según el wizard.
2. Si no hay datos pendientes del wizard de empresa pero hay texto de empresa: se busca en `GET /companies` (por nombre, sin distinguir mayúsculas); si no existe, `POST /companies` solo con `name`.
3. `assignedTo` (contacto) y el asignado de la oportunidad solo se envían si el id parece **cuid** de Prisma (usuarios del servidor).

### Detalle API

- Edición, etapa y asignación usan **PATCH**.
- Vincular empresas adicionales, contactos entre sí o empresas “solo nombre” queda **pendiente** de endpoints de enlace (misma idea que en oportunidades).
- Vincular oportunidades: si la oportunidad es de API (`cuid`), se usa **PATCH** `/opportunities/:id` con `contactId` (el backend reemplaza vínculos de contacto en esa oportunidad).

## Backend (referencia)

- `backend/src/contacts/contacts.controller.ts`
- `backend/src/contacts/contacts.service.ts`
- DTOs: `create-contact.dto.ts`, `update-contact.dto.ts`

## Oportunidades: PATCH con `contactId`

`PATCH /opportunities/:id` acepta `contactId` opcional: si se envía un id de contacto válido, se eliminan vínculos previos de esa oportunidad con contactos y se crea uno nuevo. Si se envía vacío/`null`, se quitan todos los vínculos contacto–oportunidad.

## Siguientes pasos sugeridos

- `POST/PATCH` para `CompanyContact` y `ContactContact` sin recrear entidades.
- Listar asesores desde `GET /users`.
- Restricción por roles en mutaciones.

# API de oportunidades (`/opportunities`)

CRUD conectado a Prisma (`Opportunity`). Requiere **JWT** en todas las rutas (guard global).

## Modelo (PostgreSQL)

Campos principales: `title`, `amount`, `probability`, `etapa`, `status`, `priority` (`baja` \| `media` \| `alta`, por defecto `media`), `expectedCloseDate`, `assignedTo` (FK opcional a `User`), `createdAt`, `updatedAt`.

**Estado (`status`)** se deriva de la **etapa** (solo `abierta`, `ganada`, `perdida`; no se usa `suspendida` en esta lógica):

- **ganada** si `etapa` es `cierre_ganado`, `firma_contrato` o `activo`
- **perdida** si `etapa` es `cierre_perdido` o `inactivo`
- **abierta** en el resto de etapas

En **POST** el campo `status` del body se ignora; en **PATCH**, si envías `etapa`, el servidor actualiza `status` según la regla anterior. Si solo envías `status` (sin `etapa`), se acepta `abierta` \| `ganada` \| `perdida`; cualquier otro valor se normaliza a `abierta`.

Vínculos opcionales al crear:

- **Contacto**: fila en `ContactOpportunity` si se envía `contactId` existente.
- **Empresa**: fila en `CompanyOpportunity` si se envía `companyId` existente.

La probabilidad se puede enviar explícita o calcularse desde `etapa` (misma tabla que el mock del frontend: `lead` → 0, `contacto` → 10, etc.).

## GET /opportunities

Lista todas las oportunidades (`updatedAt` descendente), con:

- hasta un contacto (para nombre en listados),
- usuario asignado (`id`, `name`).

## GET /opportunities/:id

Detalle por **id** (cuid). Incluye contactos vinculados, empresas vinculadas y usuario asignado. **404** si no existe.

## POST /opportunities

**Body (JSON)**

| Campo | Obligatorio | Descripción |
|--------|-------------|-------------|
| `title` | sí | Título |
| `amount` | sí | Monto (≥ 0) |
| `etapa` | sí | Etapa (string, ej. `lead`, `negociacion`) |
| `probability` | no | Entero; si se omite, se deriva de `etapa` |
| `status` | no | Ignorado: se calcula desde `etapa` (ver arriba) |
| `priority` | no | `baja`, `media` o `alta` (default `media` si se omite o valor inválido) |
| `expectedCloseDate` | no | ISO date string |
| `assignedTo` | no | Id de `User` en BD |
| `contactId` | no | Id de `Contact` existente |
| `companyId` | no | Id de `Company` existente |

**400** si faltan campos obligatorios, monto negativo, usuario/contacto/empresa inexistente o fecha inválida.

### Ejemplo

```bash
curl -s -X POST http://localhost:3000/opportunities \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Plan VIP","amount":50000,"etapa":"negociacion","expectedCloseDate":"2026-06-01"}'
```

## PATCH /opportunities/:id

Actualización parcial. Si se envía `etapa` sin `probability`, se recalcula la probabilidad y **`status` se deriva de la nueva etapa**. `expectedCloseDate` puede enviarse como `null` para limpiar.

**400** si no hay campos que actualizar o validaciones fallan. **404** si el id no existe.

## DELETE /opportunities/:id

Elimina la oportunidad; las filas en tablas puente con `onDelete: Cascade` se eliminan según el esquema.

## Frontend

| Uso | Archivo |
|-----|---------|
| Listado API + mock (merge por `id`) | `frontend/src/pages/Opportunities.tsx` |
| Detalle por **cuid** o id mock | `frontend/src/pages/OportunidadDetail.tsx` |
| Tipos / mapeo | `frontend/src/lib/opportunityApi.ts` |

### Alta desde el formulario

Se hace **POST** al servidor. `assignedTo` y `contactId` solo se envían si el valor parece un **cuid** de Prisma (mismo criterio que empresas); los ids solo-mock no se envían y la oportunidad queda sin asignado / sin contacto en BD hasta que existan datos reales.

### Detalle

Si la ruta es un cuid, se usa **GET** y **PATCH** contra la API para editar, cambiar etapa y asignar (el asignado debe ser un usuario válido en servidor).

La vinculación crear/vincular contacto o empresa desde la UI en oportunidades **solo-API** queda pendiente del módulo de contactos y endpoints de enlace.

## Backend (referencia)

- `backend/src/opportunities/opportunities.controller.ts`
- `backend/src/opportunities/opportunities.service.ts`
- DTOs: `create-opportunity.dto.ts`, `update-opportunity.dto.ts`

## Siguientes pasos sugeridos

- Endpoints para añadir/quitar `ContactOpportunity` y `CompanyOpportunity` sin recrear la oportunidad.
- Restringir mutaciones por rol.
- Alinear lista de asesores del frontend con `GET /users` del servidor.

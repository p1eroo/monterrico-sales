# Plan de implementación — Usuarios API y Enlaces API

Detalle técnico de los pasos 1 y 2 del roadmap.

---

## PASO 2 (primero): Usuarios desde API

### Objetivo
Dejar de usar `users` de `@/data/mock` y cargar usuarios reales desde `GET /users` en todos los componentes que necesitan listar asesores.

### Estado actual

| Ubicación | Uso actual |
|-----------|------------|
| **AssignDialog** | `users` mock para selector de asesor |
| **ActivityFormDialog** | `users` mock para asignar actividad |
| **NewContactWizard** | `users.filter(u => u.status === 'activo')` para selector "Asesor asignado" |
| **NewCompanyWizard** | Idem para "Propietario" |
| **NewOpportunityDialog** | Idem para asignar oportunidad |
| **NewOpportunityFromPipelineDialog** | Idem |
| **QuickActionsWithDialogs** | `users[0]` como default al crear tarea |
| **Pipeline** | Selector de asesor al mover tarjeta |
| **Opportunities** | Filtro/selector por asesor |
| **Empresas** | Filtro por asesor |
| **Contactos** | Filtro por asesor |
| **Calendario** | `users` para eventos y EventFormModal |
| **EventFormModal** | Selector de asesor |
| **TasksTab** | Selector al crear/editar tarea |
| **TaskFormDialog** | Idem |
| **TaskDetailDialog** | Idem |
| **Reports** | Filtro por asesor |
| **EmpresaDetail** | `users.find` para mostrar nombre del asesor |
| **ContactoDetail** | Idem |
| **OportunidadDetail** | Idem |
| **Clients** | Filtro y asignación |
| **Settings** | Roles por usuario |
| **Audit** | Filtro por usuario |
| **crmStore** | `getUserName(userId)` usa `users.find` |
| **filesStore** | Idem |

### Cambios a realizar

1. **Crear hook `useUsers()`** en `frontend/src/hooks/useUsers.ts`:
   - Llama a `GET /users` una vez al montar (o con caché global).
   - Devuelve `{ users, loading, error, refetch }`.
   - Formato compatible con el actual: `{ id, name, status, ... }` para no romper componentes.

2. **Crear tipo `ApiUserRecord`** (si no existe) en `frontend/src/lib/` o `types`:
   - Campos: `id`, `name`, `username`, `role`, `status`, etc. según respuesta del backend.

3. **Reemplazar en cada componente**:
   - `import { users } from '@/data/mock'` → `const { users } = useUsers()`.
   - Para filtro "activos": `users.filter(u => u.status === 'activo')` (el backend ya devuelve `status`).
   - Manejar estado `loading` (skeleton o deshabilitar select).
   - Fallback si no hay usuarios: mostrar "Sin asignar" o lista vacía.

4. **Store (crmStore, filesStore)**:
   - Opción A: Pasar `users` como dependencia o usar `useUsers()` dentro si el store es reactivo.
   - Opción B: Crear un `usersStore` separado que llame a la API y los demás lean de ahí.

5. **Mapeo backend → frontend**:
   - El backend devuelve `User` con `id` (cuid), `name`, `username`, `role`, `status`.
   - Compatible con el tipo actual; solo hay que asegurar que `status === 'activo'` se use igual.

### Archivos a tocar (estimado)

- `hooks/useUsers.ts` (nuevo)
- `AssignDialog.tsx`
- `ActivityFormDialog.tsx`
- `NewContactWizard.tsx`
- `NewCompanyWizard.tsx`
- `NewOpportunityDialog.tsx`
- `NewOpportunityFromPipelineDialog.tsx`
- `QuickActionsWithDialogs.tsx`
- `Pipeline.tsx`
- `Opportunities.tsx`
- `Empresas.tsx`
- `Contactos.tsx`
- `Calendario.tsx`
- `EventFormModal.tsx`
- `TasksTab.tsx`
- `TaskFormDialog.tsx`
- `TaskDetailDialog.tsx`
- `Reports.tsx`
- `EmpresaDetail.tsx`
- `ContactoDetail.tsx`
- `OportunidadDetail.tsx`
- `Clients.tsx`
- `Settings.tsx`
- `Audit.tsx`
- `store/crmStore.ts` (getUserName)
- `store/filesStore.ts`

---

## PASO 1: Enlaces vía API

### Objetivo
Eliminar los toasts "Próximamente" y permitir vincular empresas y contactos entre sí usando la base de datos real.

### Contexto del backend

| Tabla | Uso | Endpoints actuales |
|-------|-----|--------------------|
| **CompanyContact** | Contacto ↔ Empresa | Se crea en `POST /contacts` con `companyId`. No hay endpoint para añadir empresas extra a un contacto existente. |
| **ContactContact** | Contacto ↔ Contacto (enlaces) | No hay endpoints. |
| **ContactOpportunity** | Contacto ↔ Oportunidad | Se crea en `POST /opportunities` con `contactId`. `PATCH /opportunities/:id` acepta `contactId`. |
| **CompanyOpportunity** | Empresa ↔ Oportunidad | Se crea en `POST /opportunities` con `companyId`. |

### A) Vincular nueva empresa a un contacto (ContactoDetail, fromApi)

**Situación:** El usuario está en el detalle de un contacto que viene de la API. Pulsa "Crear empresa" y llena el formulario (NewCompanyWizard). Hoy muestra toast "Próximamente".

**Flujo deseado:**
1. Crear empresa con `POST /companies` (si la empresa es nueva).
2. Crear vínculo con `POST /contacts/:contactId/companies` o similar con `{ companyId }`.

**Backend necesario:**
- Endpoint `POST /contacts/:contactId/companies` con body `{ companyId, isPrimary? }`.
- O extender `PATCH /contacts/:id` para aceptar `companyIds: string[]` (añadir vínculos sin borrar existentes).

**Frontend:**
- En `ContactoDetail.handleAddCompany`, cuando `fromApi`:
  - Si la empresa es nueva: `POST /companies` con datos del wizard.
  - Llamar al nuevo endpoint para vincular `companyId` con `contactId`.
  - Refrescar el contacto con `GET /contacts/:id`.
  - Quitar el toast "Próximamente".

---

### B) Vincular empresas existentes a un contacto (ContactoDetail, fromApi)

**Situación:** El usuario quiere vincular empresas que ya existen en el servidor.

**Flujo deseado:**
1. Listar empresas con `GET /companies`.
2. Usuario elige una o varias.
3. Crear vínculos `CompanyContact` para cada una.

**Backend:** El mismo endpoint que en (A).

**Frontend:**
- Cambiar `LinkExistingDialog` o el flujo de "Vincular empresas existentes" para que use `GET /companies` y envíe `companyId` al endpoint de (A).
- La UI actual busca por nombre en el store mock; hay que pasarla a búsqueda por lista de empresas API.

---

### C) Vincular contactos entre sí (ContactContact)

**Situación:** Desde el detalle de un contacto se quiere vincular con otro contacto.

**Backend necesario:**
- `POST /contacts/:contactId/links` con body `{ linkedContactId: string }`.
- O `DELETE /contacts/:contactId/links/:linkedId` para desvincular.

**Implementación en Nest:**
- Crear métodos en `ContactsService`: `addLinkedContact(contactId, linkedId)`, `removeLinkedContact(contactId, linkedId)`.
- Usar `prisma.contactContact.create` y `delete`.

**Frontend:**
- En `ContactoDetail.handleLinkContacts`, cuando `fromApi`:
  - Para cada `linkContactId` elegido, llamar `POST /contacts/:contactId/links` con `{ linkedContactId }`.
  - Refrescar el contacto.
  - Quitar el toast "Próximamente".

---

### D) Crear contacto nuevo y vincular a oportunidad (OportunidadDetail, fromApi)

**Situación:** Estamos en el detalle de una oportunidad (API). El usuario crea un contacto nuevo y quiere vincularlo.

**Flujo deseado:**
1. `POST /contacts` para crear el contacto (con o sin empresa).
2. `PATCH /opportunities/:oppId` con `contactId: newContact.id` para vincular.

**Backend:** Ya soporta `contactId` en `PATCH /opportunities/:id`.

**Frontend:**
- En `OportunidadDetail.handleCreateNewContact`, cuando `fromApi`:
  - Llamar `POST /contacts` con los datos del NewContactWizard.
  - Si hay empresa nueva, crearla antes y pasar `companyId`.
  - Llamar `PATCH /opportunities/:oppId` con `contactId: createdContact.id`.
  - Refrescar oportunidad y contactos.
  - Quitar el toast "Próximamente".

---

### E) Vincular contacto existente a oportunidad (OportunidadDetail, fromApi)

**Situación:** Vincular un contacto que ya existe a la oportunidad.

**Backend:** `PATCH /opportunities/:id` con `contactId` ya funciona (según OpportunitiesService).

**Frontend:**
- Revisar en `OportunidadDetail` si hay algún bloqueo cuando `fromApi`.
- Asegurar que el `LinkExistingDialog` de contactos use `GET /contacts` para listar y que al confirmar se llame `PATCH /opportunities/:id` con el `contactId` elegido.
- Si hoy muestra "Próximamente", habilitar ese flujo.

---

### Resumen de endpoints a crear en backend

| Método | Ruta | Body | Descripción |
|--------|------|------|-------------|
| POST | `/contacts/:id/companies` | `{ companyId, isPrimary? }` | Añadir empresa a contacto |
| DELETE | `/contacts/:id/companies/:companyId` | — | Quitar empresa de contacto |
| POST | `/contacts/:id/links` | `{ linkedContactId }` | Vincular contacto con otro |
| DELETE | `/contacts/:id/links/:linkedId` | — | Desvincular contactos |

---

### Orden recomendado de implementación

1. **Usuarios desde API** (Paso 2) — Sin cambios en backend.
2. **Backend:** Endpoints para CompanyContact y ContactContact.
3. **Frontend ContactoDetail:** Vincular nueva empresa, vincular existentes, vincular contactos.
4. **Frontend OportunidadDetail:** Crear contacto + vincular, vincular contacto existente.

---

¿Por cuál paso quieres que empiece la implementación?

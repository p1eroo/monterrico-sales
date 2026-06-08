# Roadmap — Próximos pasos

Estado actual del proyecto y mejoras sugeridas ordenadas por prioridad.

> **Plan de implementación detallado** (pasos 1 y 2): [ROADMAP_IMPLEMENTACION.md](./ROADMAP_IMPLEMENTACION.md)

---

## Lo completado recientemente

- **API vs mock — Paso 1:** `crmStore` sin datos iniciales (contactos y oportunidades vacíos al iniciar). Listados (Contactos, Oportunidades, Empresas, Pipeline) usan API como fuente. Pipeline cargado desde `GET /contacts`; arrastrar y cambiar etapa/asignación llama a `PATCH /contacts/:id`.
- **API vs mock — Paso 3:** Creación de contactos y oportunidades vía API: Empresas (Nueva Empresa) crea company → contact → opportunity en el servidor; EmpresaDetail (crear contacto/oportunidad) usa API cuando `fromApiById`; ContactoDetail y OportunidadDetail ya usaban API cuando `fromApi`. `contactCreate` en `contactApi.ts`. Empresas carga contactos desde API para el listado.
- **Mejoras:** `opportunityApi.ts` usa `useUsersStore.getUserName()` en lugar de mock. EmpresaDetail por slug: `resolvedCompanyId` se obtiene de los contactos cargados (cuando la empresa tiene contactos en API), permitiendo crear contacto/oportunidad vía API también al entrar por nombre de empresa.
- **Teléfono en Empresas:** Columna `telefono` en `Company` (Prisma + migración). Se guarda al crear/editar empresa desde formularios. Ver en EmpresaDetail (vista y edición).
- **API Factiliza:** DNI/CEE/RUC con auto-llenado al pulsar Enter en formularios de contacto y empresa.
- **Usuarios desde API:** Los selectores de asesor cargan usuarios reales de `GET /users`. Hook `useUsers()`, store `usersStore`. Migración completa en Audit, Settings, Clients, Reports, Team.
- **Enlaces vía API:** Backend expone `POST/DELETE /contacts/:id/companies` y `POST/DELETE /contacts/:id/links`. ContactoDetail y OportunidadDetail usan la API para vincular empresas, contactos y oportunidades (fromApi).
- **Actividades reales:** `ActivitiesService` con Prisma. **Tareas** y **Calendario** usan `useActivities()` y el endpoint `/activities` (CRUD). Mapper `activityToCalendarEvent` para la vista de calendario.
- **API vs mock — Listados y pipeline (2026-03):** Sin merge con `crmStore` en **Contactos**, **Oportunidades** y **Pipeline**; la fuente es la API. Pipeline carga `opportunityListAll()` y asocia la primera oportunidad por `contactId` a cada tarjeta. Eliminado el fallback “modo local” al fallar `POST /opportunities` desde pipeline. **Dashboard** y **notificaciones** (empresas inactivas) usan `contactListAll()` en lugar del store. Detalle por **cuid** (`ContactoDetail`, `OportunidadDetail`, `EmpresaDetail` por id): listas y vínculos priorizan API; `crmStore` queda sobre todo para rutas mock y mutaciones locales heredadas.
- **UI optimista (altas):** `optimisticCrmStore` (Zustand) + `buildOptimisticContact` / `buildOptimisticOpportunity`: la fila aparece al instante en **Contactos** y **Oportunidades** mientras se completa el `POST`; reconciliación al éxito o error (`removePending*` + recarga API).
- **Autorización CRM en backend:** `PermissionsGuard` + `@RequirePermissions(...)` en `contacts`, `companies`, `opportunities`, `activities` y **Factiliza** (DNI/CEE → `contactos.ver`, RUC → `empresas.ver`). Se validan filas `Authority` del rol del usuario (JWT incluye `roleId`). Cerrar sesión y volver a entrar tras desplegar para obtener token con `roleId`.

---

## 1. Prioridad media — Reducir API vs mock (restante)

**Hecho:** Listados principales, pipeline, dashboard/notificaciones, UI optimista en altas (ver arriba).

**Siguiente paso:** Deprecar o documentar como demo las rutas/mutaciones solo-mock en detalle. Revisar pantallas que aún usan `@/data/mock` para **datos de negocio** (informes, campañas, `UserDetail`, gráficos Dashboard, `weeklySales`/`monthlySales`, etc.); las importaciones de **etiquetas** (`etapaLabels`, `contactSourceLabels`, …) pueden quedarse como catálogo UI.

---

## 3. Prioridad media — Autorización en backend (ampliar)

**Hecho:** CRM principal + actividades + Factiliza según permisos en `Authority`.

**Siguiente:** Alinear **roles** (`GET/POST/PATCH/DELETE /roles`) y otros endpoints con la misma convención `módulo.acción`; revisar `GET /users` (¿solo admin o `usuarios.ver`?).

---

## 4. Prioridad baja — Archivos y correo

- Storage real para adjuntos
- Sustituir `emailApi` mock si Inbox es prioritario

---

## 5. Prioridad baja — DX y calidad

- OpenAPI/Swagger en backend
- Tests e2e de flujos auth + CRUD principal
- Ampliar matriz API vs mock en `docs/README.md` cuando se migren informes/campañas

---

## Migración pendiente

Ejecutar en el backend cuando tengas acceso a la base de datos:

```bash
cd backend && npx prisma migrate deploy
```

La migración `20260326120000_add_company_telefono` añade la columna `telefono` a `Company`.

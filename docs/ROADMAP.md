# Roadmap — Próximos pasos

Estado actual del proyecto y mejoras sugeridas ordenadas por prioridad.

> **Plan de implementación detallado** (pasos 1 y 2): [ROADMAP_IMPLEMENTACION.md](./ROADMAP_IMPLEMENTACION.md)

---

## Lo completado recientemente

- **API vs mock — Paso 1:** `crmStore` sin datos iniciales (contactos y oportunidades vacíos al iniciar). Listados (Contactos, Oportunidades, Empresas, Pipeline) usan API como fuente. Pipeline cargado desde `GET /contacts`; arrastrar y cambiar etapa/asignación llama a `PATCH /contacts/:id`.
- **API vs mock — Paso 3:** Creación de contactos y oportunidades vía API: Empresas (Nueva Empresa) crea company → contact → opportunity en el servidor; EmpresaDetail (crear contacto/oportunidad) usa API cuando `fromApiById`; ContactoDetail y OportunidadDetail ya usaban API cuando `fromApi`. `contactCreate` en `contactApi.ts`. Empresas carga contactos desde API para el listado.
- **Teléfono en Empresas:** Columna `telefono` en `Company` (Prisma + migración). Se guarda al crear/editar empresa desde formularios. Ver en EmpresaDetail (vista y edición).
- **API Factiliza:** DNI/CEE/RUC con auto-llenado al pulsar Enter en formularios de contacto y empresa.
- **Usuarios desde API:** Los selectores de asesor cargan usuarios reales de `GET /users`. Hook `useUsers()`, store `usersStore`. Migración completa en Audit, Settings, Clients, Reports, Team.
- **Enlaces vía API:** Backend expone `POST/DELETE /contacts/:id/companies` y `POST/DELETE /contacts/:id/links`. ContactoDetail y OportunidadDetail usan la API para vincular empresas, contactos y oportunidades (fromApi).
- **Actividades reales:** `ActivitiesService` con Prisma. **Tareas** y **Calendario** usan `useActivities()` y el endpoint `/activities` (CRUD). Mapper `activityToCalendarEvent` para la vista de calendario.

---

## 1. Prioridad media — Reducir API vs mock

El store Zustand sigue con contactos/oportunidades mock que conviven con datos del servidor.

**Acción:** Definir política clara: tras login, usar solo API o sincronizar bien; evitar merge indefinido en listados para reducir duplicados y bugs.

---

## 3. Prioridad media — Autorización en backend

En `EMPRESAS_API.md` se menciona restringir POST/PATCH/DELETE por rol.

**Acción:** Aplicar guards/permisos en backend para empresas, contactos, oportunidades según rol; alinear con `usePermissions` del frontend.

---

## 4. Prioridad baja — Archivos y correo

- Storage real para adjuntos
- Sustituir `emailApi` mock si Inbox es prioritario

---

## 5. Prioridad baja — DX y calidad

- OpenAPI/Swagger en backend
- Tests e2e de flujos auth + CRUD principal
- Documentar en `docs/README.md` qué pantallas usan API vs mock

---

## Migración pendiente

Ejecutar en el backend cuando tengas acceso a la base de datos:

```bash
cd backend && npx prisma migrate deploy
```

La migración `20260326120000_add_company_telefono` añade la columna `telefono` a `Company`.

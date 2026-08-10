
# Monterrico Sales — Visión General del Proyecto

> Documentación técnica completa para que cualquier IA o desarrollador entienda la arquitectura, stack, modelos, APIs, flujos y convenciones del proyecto.

---

## 1. ¿Qué es este proyecto?

**Monterrico Sales** es un CRM full‑stack para **Taxi Monterrico**, una empresa peruana de transporte. Gestiona tres áreas de negocio:

| Área | Propósito |
|------|-----------|
| **Comercial** | CRM de ventas: contactos, empresas, oportunidades, pipeline, tareas, campañas, reportes, archivos, asistente IA |
| **Flota** | Gestión de prospectos conductores importados desde Google Sheets, mensajería WhatsApp, integración con Chatwoot |
| **Marketing** | Facebook Lead Ads, prospección Apollo.io |

---

## 2. Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| **Backend** | [NestJS](https://nestjs.com/) v11 (TypeScript) |
| **Frontend** | React v19 + TypeScript + [Vite](https://vitejs.dev/) v7 |
| **Base de datos** | PostgreSQL + [Prisma ORM](https://www.prisma.io/) v7 + pgvector |
| **Autenticación** | JWT (passport‑jwt) + bcrypt + OAuth2 (Google) |
| **UI** | [shadcn/ui](https://ui.shadcn.com/) (Radix UI) + Tailwind CSS v4 |
| **Estado** | [Zustand](https://zustand-demo.pmnd.rs/) v5 (persistido en localStorage) |
| **Routing** | react-router-dom v7 |
| **Gráficos** | Recharts v3 |
| **Drag & drop** | @dnd-kit (pipeline), @xyflow/react (bot flow builder) |
| **Formularios** | react‑hook‑form + zod |
| **Editor rico** | TipTap |
| **PDF/Excel** | jsPDF, ExcelJS, xlsx |
| **WhatsApp** | Evolution GO API + Socket.IO (tiempo real) |
| **Email** | Nodemailer (campañas SMTP) + Gmail API |
| **Almacenamiento** | MinIO/S3‑compatible (`@aws-sdk/client-s3`), proxy de medios |
| **IA** | OpenAI API (chat + embeddings) + pgvector (RAG) |
| **Calendario** | Google Calendar API |
| **Datos externos** | Factiliza (SUNAT — consulta RUC/DNI), Google Sheets |
| **Tiempo real** | Socket.IO (notificaciones WhatsApp, eventos Chatwoot) |
| **Tareas programadas** | @nestjs/schedule (cron jobs) |

---

## 3. Estructura de directorios

```
monterrico-sales/
├── docs/                              # Documentación del proyecto
│   ├── 00_PROJECT_OVERVIEW.md         # ← este archivo
│   ├── README.md                      # Resumen API vs mock, matriz de permisos
│   ├── AUTH.md                        # Auth local: migración, primer user, login
│   ├── AUTH_Y_API.md                  # JWT, api() client, permisos, registro
│   ├── CONTACTOS_API.md               # CRUD de contactos
│   ├── EMPRESAS_API.md                # CRUD de empresas
│   ├── OPORTUNIDADES_API.md           # CRUD de oportunidades
│   ├── USUARIOS_API.md               # CRUD de usuarios
│   ├── FACTILIZA.md                   # Integración Factiliza (SUNAT)
│   ├── CHATWOOT_INTEGRACION.md        # Integración Chatwoot inbox
│   ├── AGENTES_IA_Y_BOT_FLOW.md       # Agentes IA + Bot Flow builder
│   ├── ROADMAP.md                     # Tareas completadas y pendientes
│   └── ROADMAP_IMPLEMENTACION.md      # Pasos detallados de implementación
│
├── backend/                           # Servidor NestJS
│   ├── package.json
│   ├── .env / .env.example
│   ├── prisma/
│   │   ├── schema.prisma              # Esquema completo (831 líneas, 35+ modelos)
│   │   └── migrations/                # Migraciones de BD (~60+)
│   ├── src/
│   │   ├── main.ts                    # Bootstrap: CORS, Socket.IO, límite de body
│   │   ├── app.module.ts              # Módulo raíz: importa todos los módulos
│   │   ├── app.controller.ts          # Health check público
│   │   ├── socket-io.adapter.ts       # Adaptador Socket.IO
│   │   ├── prisma/                    # PrismaModule + PrismaService (global)
│   │   ├── auth/                      # JWT, bcrypt, Google OAuth, guards, decorators
│   │   ├── users/                     # CRUD de usuarios (solo admin para mutaciones)
│   │   ├── roles/                     # CRUD de roles + Authorities
│   │   ├── companies/                 # CRUD de empresas + scheduler stale‑etapa
│   │   ├── contacts/                  # CRUD de contactos + vinculación
│   │   ├── opportunities/             # CRUD de oportunidades + vinculación
│   │   ├── activities/                # CRUD de actividades/tareas
│   │   ├── activity-logs/             # Auditoría general (log de actividad)
│   │   ├── audit-detail/              # Auditoría detallada (cambios campo a campo)
│   │   ├── campaigns/                 # Campañas de email (envíos masivos SMTP)
│   │   ├── files/                     # Upload/descarga de archivos (S3/MinIO/proxy)
│   │   ├── crm-config/                # Config CRM: etapas, fuentes, prioridades, metas
│   │   ├── analytics/                 # Datos para dashboard y reportes
│   │   ├── import-export/             # Import/export CSV con jobs
│   │   ├── ai/                        # Asistente IA (chat + streaming + herramientas)
│   │   ├── knowledge-bases/           # Bases de conocimiento RAG (vector search)
│   │   ├── media/                     # Proxy de upload de medios
│   │   ├── mail/                      # Servicio SMTP
│   │   ├── notifications/             # Notificaciones in‑app
│   │   ├── whatsapp/                  # WhatsApp (Evolution GO + webhooks + Socket.IO)
│   │   ├── flota-prospectos/          # Prospectos conductores (import Google Sheets)
│   │   ├── factiliza/                 # Consulta RUC/DNI vía Factiliza (SUNAT)
│   │   ├── facebook-leads/            # Facebook Lead Ads (webhook + import)
│   │   ├── chatwoot/                  # Proxy Chatwoot inbox
│   │   ├── apollo/                    # Prospección Apollo.io
│   │   ├── gmail/                     # Gmail API (hilos, envío, borradores)
│   │   ├── google-calendar/           # Google Calendar sync
│   │   ├── sync/                      # Servicio de sincronización de entidades
│   │   ├── clients/                   # Registros de clientes (empresas → clientes)
│   │   └── common/                    # Utilidades compartidas (CSV, audit‑diff, URL slugs)
│   └── scripts/                       # Scripts de migración/backfill
│
└── frontend/                          # React + Vite SPA
    ├── package.json
    ├── vite.config.ts                 # Vite: aliases, code splitting, Tailwind
    ├── index.html
    └── src/
        ├── App.tsx                    # Raíz: routing, guards de auth, módulos/áreas
        ├── pages/                     # Componentes de página por ruta
        │   ├── Login.tsx, Register.tsx, AreaSelect.tsx, GoogleAuthCallback.tsx
        │   ├── comercial/             # Dashboard, Contactos, Empresas, Pipeline, etc.
        │   ├── admin/                 # AdminDashboard, Users, UserDetail, Audit
        │   ├── flota/                 # FlotaDashboard, FlotaProspectos, FlotaMensajes, etc.
        │   └── marketing/             # MarketingDashboard, Leads, Integrations
        ├── components/                # Componentes reutilizables
        │   ├── ui/                    # shadcn/ui primitives (35+ componentes)
        │   ├── shared/                # Componentes CRM compartidos (50+ archivos)
        │   ├── layout/                # MainLayout, AppSidebar, Topbar, ModuleGate, AreaGate
        │   ├── assistant/             # AI assistant drawer
        │   ├── calendar/              # Componentes de calendario
        │   ├── files/                 # Upload/display de archivos
        │   ├── notifications/         # Centro de notificaciones
        │   ├── roles/                 # Gestión de roles
        │   ├── tasks/                 # Tablero Kanban
        │   ├── flota/                 # Chat panel, Chatwoot inbox, notification bell
        │   ├── crm/                   # Gráfico de embudo
        │   ├── icons/                 # 30+ iconos SVG personalizados
        │   └── system/               # AppUpdateBanner
        ├── modules/                   # Módulos complejos
        │   ├── comercial/agentes-ia/  # Agentes IA (flows, workflow)
        │   └── flota/bot-flow/        # Bot flow builder visual (nodos, Flow)
        ├── lib/                       # API clients, utilidades (65+ archivos)
        ├── store/                     # Stores de Zustand (13 stores)
        ├── hooks/                     # Hooks React (11 hooks)
        ├── services/                  # Servicio de API email
        ├── types/                     # Definiciones TypeScript (615 líneas)
        ├── data/                      # Datos mock (en proceso de deprecación → API)
        └── assets/                    # Imágenes (logos, iconos)
```

---

## 4. Base de datos: modelos Prisma

El esquema completo está en `backend/prisma/schema.prisma` (831 líneas). Resumen por dominio:

### 4.1 Autenticación y RBAC

| Modelo | Propósito |
|--------|-----------|
| **User** | Perfil del usuario (nombre, rol, estado, avatar, `allowedAreas`, `sessionVersion`) |
| **Account** | Auth multi‑provider (`credentials`, `google`). Guarda `username`/`passwordHash` o tokens OAuth |
| **Role** | Rol con slug (`admin`, `supervisor`, `asesor`, `solo_lectura`). `isSystem` protege contra eliminación |
| **Authority** | Permisos por rol: `<modulo>.<accion>` (ej. `contactos.ver`, `empresas.crear`). Único por `(roleId, permission)` |

### 4.2 Entidades principales del CRM

| Modelo | Campos clave |
|--------|-------------|
| **Contact** | `urlSlug`, `name`, `cargo`, `telefono`, `correo`, `fuente`, `etapa`, `assignedTo`, `estimatedValue` |
| **Company** | `urlSlug`, `name`, `razonSocial`, `ruc`, `telefono`, `domain`, `rubro`, `etapa`, `assignedTo`, `facturacionEstimada` |
| **Client** | 1:1 con Company (se crea al llegar a etapa "Activo" o probabilidad 100%). Estados: `activo`, `inactivo`, `potencial` |
| **Opportunity** | `urlSlug`, `title`, `amount`, `probability`, `etapa`, `status` (`abierta`/`ganada`/`perdida`), `priority`, `expectedCloseDate` |
| **Activity** | `type`, `taskKind`, `title`, `description`, `status`, `priority`, `dueDate`, `startDate`, `assignedTo` |

### 4.3 Tablas de unión (muchos a muchos)

| Tabla | Relación |
|-------|----------|
| **CompanyContact** | Company ↔ Contact (con `isPrimary`) |
| **ContactContact** | Contact ↔ Contact (colegas) |
| **ContactOpportunity** | Contact ↔ Opportunity |
| **CompanyCompany** | Company ↔ Company (relacionadas) |
| **CompanyOpportunity** | Company ↔ Opportunity |
| **OpportunityOpportunity** | Opportunity ↔ Opportunity |
| **ContactActivity**, **CompanyActivity**, **OpportunityActivity** | Activity vinculada a cada entidad |

### 4.4 Configuración CRM

| Modelo | Propósito |
|--------|-----------|
| **CrmOrganizationProfile** | Singleton: datos de la organización, meta global |
| **CrmMonthlySalesTarget** | Meta mensual de facturación del equipo |
| **CrmUserSalesGoal** | Metas semanales/mensuales por usuario |
| **CrmUserMonthlySalesTarget** | Meta mensual de facturación por usuario |
| **CrmStage** | Catálogo de etapas del pipeline (slug, nombre, color, probabilidad) |
| **CrmLeadSource** | Catálogo de fuentes de leads |
| **CrmPriority** | Catálogo de prioridades |
| **CrmActivityType** | Catálogo de tipos de actividad |

### 4.5 IA y conocimiento

| Modelo | Propósito |
|--------|-----------|
| **AiConversation** | Sesión de chat del asistente IA (por usuario, multi‑hilo) |
| **AiMessage** | Mensaje individual (rol: `user`/`assistant`) |
| **AiKnowledgeBase** | Fuentes de conocimiento RAG (documentos, web, FAQ, tabular) |
| **AiKnowledgeChunk** | Embeddings vectoriales (pgvector, 1536 dimensiones) |
| **AiAssistantInstruction** | Instrucciones editables del system prompt del copiloto |

### 4.6 Auditoría

| Modelo | Propósito |
|--------|-----------|
| **ActivityLog** | Auditoría general: login, CRUD, acciones de módulo (`action`, `module`, `entityType`, `status`) |
| **AuditChangeSet** | Agrupación de cambios campo a campo (quién cambió qué entidad) |
| **AuditChangeEntry** | Cambios individuales (`fieldKey`, `oldValue` → `newValue`) |

### 4.7 Campañas

| Modelo | Propósito |
|--------|-----------|
| **Campaign** | Campaña email/WhatsApp (nombre, estado, canal, mensaje JSON, destinatarios, contadores) |
| **CampaignEmailSendLog** | Rate‑limiting anti‑spam por destinatario/hora |
| **FlotaBulkCampaign** | Campaña masiva WhatsApp de Flota |

### 4.8 WhatsApp

| Modelo | Propósito |
|--------|-----------|
| **WhatsappInstance** | Instancia Evolution GO (personal/compartida, QR, estado de conexión) |
| **CrmWhatsappMessage** | Mensajes entrantes/salientes (vinculados a Contact o FlotaProspecto) |

### 4.9 Flota (conductores)

| Modelo | Campos clave |
|--------|-------------|
| **FlotaProspecto** | `nombreCompleto`, `celular`, `estado`, `modalidad`, `placa`, `distrito`, `esDuplicado`, `chatwootContactId`, `chatwootConversationId` |
| **FlotaLlamada** | Vinculado a FlotaProspecto (`userName`, `notas`) |

### 4.10 Facebook / Marketing

| Modelo | Propósito |
|--------|-----------|
| **FacebookAccount** | Página de Facebook conectada (pageId, accessToken) |
| **FacebookForm** | Formulario de lead ads dentro de una página |
| **FacebookLead** | Lead individual (puede importarse como Contact o FlotaProspecto) |

### 4.11 Notificaciones y archivos

| Modelo | Propósito |
|--------|-----------|
| **CrmNotification** | Notificación in‑app (desduplicada por `userId + dedupeKey`) |
| **CrmFile** | Metadatos de archivo (S3 key, mime, size). Vinculado por `entityType + entityId` |

---

## 5. API: endpoints del backend

Todas las rutas requieren JWT Bearer token, excepto las marcadas `@Public()`.

### 5.1 Auth (`/auth`)

| Método | Ruta | Público | Descripción |
|--------|------|---------|-------------|
| POST | `/auth/login` | ✓ | Login con username + password → JWT + perfil |
| POST | `/auth/register` | ✓ | Registro (si `ALLOW_OPEN_REGISTRATION=true` o 0 usuarios) |
| GET | `/auth/me` | ✗ | Perfil del usuario actual con permisos |
| PATCH | `/auth/me` | ✗ | Actualizar perfil propio |
| POST | `/auth/change-password` | ✗ | Cambiar contraseña |
| POST | `/auth/me/avatar` | ✗ | Subir avatar |
| GET | `/auth/google` | ✗ | Iniciar OAuth2 de Google |
| POST | `/auth/google/init` | ✗ | Vincular/crear cuenta Google |

### 5.2 CRUD de entidades (todos requieren JWT + permisos)

| Ruta base | Permisos requeridos |
|-----------|-------------------|
| `/users` | `usuarios.ver`, `usuarios.crear`, `usuarios.editar` |
| `/roles` | `roles.ver`, `roles.crear`, `roles.editar`, `roles.eliminar` |
| `/contacts` | `contactos.ver`, `contactos.crear`, `contactos.editar` |
| `/companies` | `empresas.ver`, `empresas.crear`, `empresas.editar` |
| `/opportunities` | `oportunidades.ver`, `oportunidades.crear`, `oportunidades.editar` |
| `/activities` | `actividades.ver`, `actividades.crear`, `actividades.editar` |
| `/clients` | `clientes.ver` |

### 5.3 Otros endpoints

| Ruta base | Descripción |
|-----------|-------------|
| `/crm-config/stages` | GET catálogo de etapas |
| `/crm-config/lead-sources` | GET fuentes de leads |
| `/crm-config/priorities` | GET prioridades |
| `/crm-config/organization-profile` | GET/PATCH perfil de organización |
| `/analytics/dashboard` | GET datos del dashboard |
| `/analytics/funnel` | GET embudo de ventas |
| `/analytics/sales-by-month` | GET ventas por mes |
| `/import-export/import/*` | POST import CSV |
| `/import-export/export/*` | POST export CSV |
| `/import-export/jobs` | GET estado de jobs de import/export |
| `/ai/conversation` | GET historial de conversaciones IA |
| `/ai/chat` | POST chat IA (streaming vía SSE en `/ai/chat/stream`) |
| `/ai/assistant-instructions` | GET/PATCH instrucciones del asistente |
| `/knowledge-bases` | CRUD de bases de conocimiento RAG |
| `/activity-logs` | GET log de actividad |
| `/audit-detail` | GET auditoría detallada |
| `/notifications` | GET notificaciones, PATCH marcar leídas |
| `/whatsapp/instances` | GET/POST instancias WhatsApp |
| `/whatsapp/send` | POST enviar mensaje WhatsApp |
| `/webhooks/evolution-go` | POST (público, token) — webhook Evolution GO |
| `/flota-prospectos` | CRUD prospectos flota |
| `/flota-prospectos/import/google-sheets` | POST import desde Google Sheets |
| `/factiliza/dni/:dni` | GET consulta DNI (SUNAT) |
| `/factiliza/ruc/:ruc` | GET consulta RUC (SUNAT) |
| `/apollo/search` | GET búsqueda Apollo.io |
| `/apollo/import` | POST importar desde Apollo |
| `/facebook-leads/accounts` | GET/POST cuentas Facebook conectadas |
| `/facebook-leads/forms` | GET formularios de lead ads |
| `/facebook-leads/leads` | GET leads, POST importar |
| `/webhooks/facebook` | GET (verify) / POST (público) — webhook Facebook |
| `/chatwoot/conversations` | GET/POST conversaciones Chatwoot |
| `/chatwoot/contacts` | GET/POST contactos Chatwoot |
| `/chatwoot/inboxes` | GET bandejas Chatwoot |
| `/chatwoot/agents` | GET agentes Chatwoot |
| `/webhooks/chatwoot` | POST (público) — webhook Chatwoot |
| `/gmail/threads` | GET hilos de Gmail |
| `/gmail/send` | POST enviar email |
| `/gmail/drafts` | POST crear borrador |
| `/google-calendar/events` | CRUD eventos de Google Calendar |
| `/files` | GET lista, POST upload, GET download, DELETE |
| `/campaigns` | CRUD campañas, POST `/:id/send` para enviar |

---

## 6. Autenticación y autorización

### 6.1 Flujo de autenticación

1. **Multi‑provider accounts**: Cada `User` puede tener múltiples `Account` (tipo `credentials` o `google`).
2. **Login local**: `POST /auth/login` con `username` + `password`. Password hasheado con bcrypt (10 rounds). Devuelve `accessToken` JWT + perfil con array de permisos.
3. **Registro**: Abierto si `ALLOW_OPEN_REGISTRATION=true` o si no hay usuarios (primer usuario).
4. **Google OAuth**: `GET /auth/google` inicia flujo. El callback vincula la cuenta Google al usuario.
5. **JWT payload**: `{ sub: userId, username, name, role, roleId, sessionVersion }`.
6. **Sesiones concurrentes**: varios navegadores/dispositivos pueden usar la misma cuenta a la vez. `sessionVersion` solo se incrementa al **cambiar contraseña** para cerrar todas las sesiones activas; si no coincide con el JWT → sesión inválida.

### 6.2 Guards

| Guard | Alcance | Función |
|-------|---------|---------|
| **JwtAuthGuard** | Global (`APP_GUARD` en `app.module.ts`) | Valida JWT en cada request. Rutas pueden excluirse con `@Public()` |
| **PermissionsGuard** | Por endpoint | Verifica `Authority` en BD. Usa decorador `@RequirePermissions(...)` |
| **@RequireAnyPermission(...)** | Por endpoint | Permite acceso si el usuario tiene al menos uno de los permisos |

### 6.3 Autorización en frontend

- `useAppStore` almacena `permissionKeys` (del endpoint `/auth/me`) y `allowedAreas`.
- **`ModuleGate`**: bloquea páginas si el usuario no tiene el permiso requerido.
- **`AreaGate`**: bloquea acceso a áreas no asignadas al usuario (`allowedAreas`).
- El cliente `api()` en `src/lib/api.ts` hace **logout automático** ante respuesta 401.
- Rate limiting: `@nestjs/throttler` (30 req/min por usuario, tracker por userId).

---

## 7. Convenciones y patrones

### 7.1 Backend (NestJS)

| Convención | Detalle |
|-----------|---------|
| **Módulo por feature** | Cada dominio (`contacts`, `companies`, etc.) es un módulo NestJS autocontenido |
| **PrismaService** | Singleton global inyectable en todos los servicios |
| **DTOs con validación** | `class-validator` en DTOs, `class-transformer` para transformación |
| **Auditoría en dos niveles** | `ActivityLog` (alto nivel) + `AuditChangeSet`/`AuditChangeEntry` (campo a campo) |
| **Archivos** | Abstracción `MediaUploadService`: soporta S3/MinIO directo o proxy de medios |
| **URL slugs** | Contact, Company y Opportunity tienen `urlSlug` único para URLs legibles. Los endpoints aceptan tanto `:slugOrId` como `:id` |
| **Soft delete** | `FlotaProspecto.eliminadoAt` para eliminación lógica; `User.status: activo/inactivo` para desactivación |
| **CRON jobs** | `@nestjs/schedule` para tareas programadas (ej. scheduler de empresas en etapa stale) |

### 7.2 Frontend (React + Vite)

| Convención | Detalle |
|-----------|---------|
| **Lazy loading** | Todas las páginas usan `React.lazy()` + `Suspense` con fallback de carga |
| **Cliente API centralizado** | `api<T>()` en `src/lib/api.ts`: auto Bearer token, JSON parse, 401 → logout |
| **Stores Zustand** | 13 stores de dominio: `crmStore`, `usersStore`, `companiesStore`, `activitiesStore`, `crmConfigStore`, `filesStore`, `notificationStore`, `goalsStore`, `opportunityCacheStore`, `optimisticCrmStore`, `importJobsStore`, `assistantStore`, `analyticsGoalStore` |
| **UI optimista** | `optimisticCrmStore` crea filas temporales al crear contactos/oportunidades; reconcilia con API |
| **shadcn/ui** | Todos los componentes base están en `src/components/ui/`. Usar `cn()` para clases condicionales |
| **Routing por área** | Tres áreas (`comercial`, `flota`, `marketing`) con árboles de rutas separados. Rutas de admin bajo `/admin/*` |
| **Permisos en UI** | `ModuleGate` y verificaciones por ruta ocultan páginas no autorizadas |
| **Google integración** | Gmail + Calendar comparten misma cuenta OAuth; flag `googleConnected` |
| **Versión** | Build produce `version.json` con hash de git para `AppUpdateBanner` |

### 7.3 Estado de migración API vs mock

| Área | Fuente actual |
|------|---------------|
| Listados (Contactos, Oportunidades) | Solo API |
| Altas (contacto/oportunidad) | API + filas temporales en `optimisticCrmStore` |
| Pipeline | `contactListAll` + `opportunityListAll` vía API |
| Dashboard "últimos contactos" | `contactListAll` vía API |
| Detalle con ID tipo cuid | API |
| Gráficos Dashboard, campañas, informes, Tareas/Calendario parcial | Aún usan datos mock de `@/data/mock` |

---

## 8. Variables de entorno principales

Archivo de referencia: `backend/.env.example`

| Variable | Descripción |
|----------|-------------|
| `DATABASE_URL` | Conexión PostgreSQL |
| `JWT_SECRET` | Secreto para firmar JWT |
| `OPENAI_API_KEY` | API key de OpenAI (opcional; sin ella usa respuestas locales) |
| `OPENAI_MODEL` | Modelo (default: `gpt-4o-mini`) |
| `OPENAI_EMBEDDING_MODEL` | Modelo de embeddings (default: `text-embedding-3-small`) |
| `SMTP_HOST/PORT/USER/PASS` | Configuración SMTP para campañas de email |
| `MEDIA_UPLOAD_URL` | URL del proxy de medios (prioritario sobre MinIO directo) |
| `S3_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET` | Configuración MinIO/S3 |
| `EVOGO_BASE_URL` | URL base de Evolution GO (WhatsApp) |
| `EVOGO_MANAGER_API_KEY` | Token global para crear instancias |
| `EVOGO_WEBHOOK_URL/SECRET` | Webhook URL y secreto |
| `FACEBOOK_APP_ID/SECRET` | Credenciales de app de Meta |
| `APOLLO_API_KEY` | API key de Apollo.io |
| `FACTILIZA_URL/TOKEN` | API de Factiliza (SUNAT) |
| `ALLOW_OPEN_REGISTRATION` | Permitir registro abierto |

---

## 9. Comandos útiles

```bash
# Backend
cd backend
npm run start:dev          # Desarrollo con hot reload
npm run build              # Compilar
npx prisma migrate dev     # Ejecutar migraciones
npx prisma generate        # Regenerar cliente Prisma
npm run lint               # ESLint
npm run test               # Tests unitarios

# Frontend
cd frontend
npm run dev                # Desarrollo (--host)
npm run build              # Compilar producción
npm run lint               # ESLint
```

---

## 10. Notas para IAs / nuevos desarrolladores

1. **Idioma**: Todo el código, comentarios y docs están en español (español peruano). Los nombres de variables/modelos mezclan español e inglés (`Contact.telefono`, `Company.razonSocial`, `Opportunity.etapa`).
2. **Prisma es la fuente de verdad**: Cualquier cambio en la BD debe hacerse en `schema.prisma` y luego migrar.
3. **Permisos**: Antes de tocar un endpoint, verificar qué permisos requiere en el controller (`@RequirePermissions`).
4. **Frontend stores**: Los datos de API fluyen a través de los stores de Zustand. No hacer llamadas directas a `api()` desde componentes sin pasar por el store correspondiente.
5. **Rutas con slugs**: Las URLs de detalle aceptan tanto `cuid` como `urlSlug`. El backend resuelve automáticamente.
6. **Auditoría**: Cada mutación relevante debe registrar `ActivityLog` y opcionalmente `AuditChangeSet` con los campos modificados.
7. **Migraciones pendientes**: Ver `docs/ROADMAP.md` para tareas completadas y pendientes.
8. **Documentación nueva**: Agregar en `docs/` y enlazar desde `docs/README.md`.

# Monterrico CRM — Endpoints por módulo

Guía compacta de la API (backend NestJS, `backend/src`).

**Convenciones**
- **Base**: sin prefijo global; cada ruta empieza tal cual. En local: `http://localhost:3000`.
- **Bearer**: todas las rutas exigen `Authorization: Bearer <token>` salvo las marcadas como públicas (webhooks, login, logos).
- **Solo lectura** = no altera datos. **Modifica datos** = escribe en BD o dispara acciones (envíos, jobs, notificaciones).
- Listados paginados: `?page=1&limit=25` (default 25, máx. 5000). Algunos detalle usan id o `urlSlug`.

---

## Autenticación (`/auth`)

POST /auth/login
- Inicia sesión y devuelve el JWT + datos del usuario.
- Bearer: no (pública)
- Modifica datos

POST /auth/register
- Crea el primer usuario (bootstrap; si `ALLOW_OPEN_REGISTRATION=true`, abierto).
- Bearer: no (pública)
- Modifica datos

POST /auth/change-password
- El usuario cambia su propia contraseña (invalida tokens antiguos).
- Bearer: sí
- Modifica datos

GET /auth/me
- Perfil del usuario autenticado (rol, permisos, áreas).
- Bearer: sí
- Solo lectura

PATCH /auth/me
- Actualiza nombre/teléfono del perfil propio.
- Bearer: sí
- Modifica datos

POST /auth/me/avatar
- Sube/reemplaza el avatar del usuario (multipart `file`, máx. 3 MB).
- Bearer: sí
- Modifica datos

GET /auth/google/status
- Indica si el usuario tiene cuenta de Google vinculada.
- Bearer: sí
- Solo lectura

POST /auth/google/disconnect
- Desvincula la cuenta de Google del usuario.
- Bearer: sí
- Modifica datos

GET /auth/google
- Inicio OAuth2 de Google (redirige al consentimiento de Google).
- Bearer: no (pública)
- Solo lectura

GET /auth/google/callback
- Callback OAuth2: vincula la cuenta y redirige al frontend.
- Bearer: no (pública)
- Modifica datos

POST /auth/google/init
- Crea un `state` efímero para el flujo de vinculación con Google.
- Bearer: no (pública; requiere JWT en el body)
- Modifica datos

---

## Usuarios (`/users`)

GET /users/asesores-equipo
- Lista asesores comerciales (vista Equipo).
- Bearer: sí
- Solo lectura

GET /users/by-role/operador
- Lista usuarios activos con rol operador.
- Bearer: sí
- Solo lectura

GET /users
- Lista todos los usuarios.
- Bearer: sí
- Solo lectura

GET /users/:id
- Detalle de un usuario.
- Bearer: sí
- Solo lectura

POST /users
- Crea un usuario con rol.
- Bearer: sí
- Modifica datos

PATCH /users/:id
- Actualiza un usuario (no cambia contraseña).
- Bearer: sí
- Modifica datos

---

## Roles (`/roles`)

GET /roles
- Lista roles con permisos y nº de usuarios.
- Bearer: sí
- Solo lectura

GET /roles/:id
- Detalle de un rol.
- Bearer: sí
- Solo lectura

POST /roles
- Crea un rol personalizado.
- Bearer: sí
- Modifica datos

PATCH /roles/:id
- Actualiza un rol (no los de sistema).
- Bearer: sí
- Modifica datos

DELETE /roles/:id
- Elimina un rol personalizado.
- Bearer: sí
- Modifica datos

---

## Configuración del CRM (`/crm-config`)

GET /crm-config
- Bundle de configuración (organización, catálogos, metas, permisos).
- Bearer: sí
- Solo lectura

PATCH /crm-config/organization
- Actualiza perfil de la organización.
- Bearer: sí
- Modifica datos

PUT /crm-config/lead-sources
- Reemplaza el catálogo de fuentes de leads.
- Bearer: sí
- Modifica datos

PUT /crm-config/rubros
- Reemplaza el catálogo de rubros.
- Bearer: sí
- Modifica datos

PUT /crm-config/stages
- Reemplaza el catálogo de etapas del pipeline.
- Bearer: sí
- Modifica datos

PUT /crm-config/priorities
- Reemplaza el catálogo de prioridades.
- Bearer: sí
- Modifica datos

PUT /crm-config/activity-types
- Reemplaza el catálogo de tipos de actividad.
- Bearer: sí
- Modifica datos

PUT /crm-config/sales-goals
- Guarda metas de ventas (globales y por asesor).
- Bearer: sí
- Modifica datos

GET /crm-config/activity-goals?weekStart=2026-09-07
- Metas semanales de actividad por usuario.
- Bearer: sí
- Solo lectura

PUT /crm-config/activity-goals
- Guarda metas semanales de actividad por usuario.
- Bearer: sí
- Modifica datos

GET /crm-config/daily-activity-goals
- Metas diarias de actividad por usuario.
- Bearer: sí
- Solo lectura

PUT /crm-config/daily-activity-goals
- Guarda metas diarias de actividad por usuario.
- Bearer: sí
- Modifica datos

---

## Empresas (`/companies`)

POST /companies
- Crea una empresa.
- Bearer: sí
- Modifica datos

POST /companies/batch-check
- Verifica si nombres/dominios ya existen (evita duplicados).
- Bearer: sí
- Solo lectura

GET /companies?page=1&limit=25
- Lista paginada de empresas (con filtros search/rubro/tipo).
- Bearer: sí
- Solo lectura

GET /companies/summary?page=1&limit=25
- Lista resumida paginada con filtros (etapa, fuente, asesor, fechas, orden).
- Bearer: sí
- Solo lectura

GET /companies/summary/etapa-counts
- Conteos por etapa para las pestañas del listado.
- Bearer: sí
- Solo lectura

GET /companies/alerts/sin-cambio-etapa
- Empresas sin cambio de etapa en ≥11 semanas (alertas).
- Bearer: sí
- Solo lectura

GET /companies/by-ruc/:ruc
- Busca empresa por RUC.
- Bearer: sí
- Solo lectura

GET /companies/:id
- Detalle completo de una empresa.
- Bearer: sí
- Solo lectura

PATCH /companies/:id
- Actualiza parcialmente una empresa.
- Bearer: sí
- Modifica datos

POST /companies/bulk-delete
- Eliminación masiva (por ids o por filtros con selectAll).
- Bearer: sí
- Modifica datos

POST /companies/bulk-reassign
- Reasignación masiva a otro asesor.
- Bearer: sí
- Modifica datos

DELETE /companies/:id
- Elimina una empresa.
- Bearer: sí
- Modifica datos

GET /companies/logo-by-domain?domain=acme.com
- Logo de la empresa según su dominio.
- Bearer: no (pública)
- Solo lectura

GET /companies/:id/logo
- Logo almacenado de una empresa.
- Bearer: no (pública)
- Solo lectura

---

## Contactos (`/contacts`)

POST /contacts
- Crea un contacto (opcional: vincula o crea empresa).
- Bearer: sí
- Modifica datos

GET /contacts?page=1&limit=25
- Lista paginada de contactos con filtros.
- Bearer: sí
- Solo lectura

GET /contacts/etapa-counts
- Conteos por etapa para las pestañas.
- Bearer: sí
- Solo lectura

GET /contacts/:id
- Detalle completo (empresas, asesor, vínculos, oportunidades).
- Bearer: sí
- Solo lectura

PATCH /contacts/:id
- Actualiza parcialmente un contacto.
- Bearer: sí
- Modifica datos

POST /contacts/:id/companies
- Vincula una empresa al contacto.
- Bearer: sí
- Modifica datos

DELETE /contacts/:id/companies/:companyId
- Desvincula una empresa del contacto.
- Bearer: sí
- Modifica datos

POST /contacts/:id/links
- Vincula dos contactos (contacto relacionado).
- Bearer: sí
- Modifica datos

DELETE /contacts/:id/links/:linkedId
- Elimina la relación entre dos contactos.
- Bearer: sí
- Modifica datos

POST /contacts/bulk-delete
- Eliminación masiva de contactos.
- Bearer: sí
- Modifica datos

POST /contacts/bulk-reassign
- Reasignación masiva a otro asesor.
- Bearer: sí
- Modifica datos

DELETE /contacts/:id
- Elimina un contacto.
- Bearer: sí
- Modifica datos

---

## Oportunidades (`/opportunities`)

POST /opportunities
- Crea una oportunidad (fusiona si ya existe la pareja contacto+empresa).
- Bearer: sí
- Modifica datos

GET /opportunities?page=1&limit=25
- Lista paginada de oportunidades con filtros.
- Bearer: sí
- Solo lectura

GET /opportunities/:id
- Detalle completo de una oportunidad.
- Bearer: sí
- Solo lectura

PATCH /opportunities/:id
- Actualiza parcialmente una oportunidad.
- Bearer: sí
- Modifica datos

DELETE /opportunities/:id/companies/:companyId
- Desvincula una empresa de la oportunidad.
- Bearer: sí
- Modifica datos

DELETE /opportunities/:id/contacts/:contactId
- Desvincula un contacto de la oportunidad.
- Bearer: sí
- Modifica datos

POST /opportunities/bulk-delete
- Eliminación masiva de oportunidades.
- Bearer: sí
- Modifica datos

POST /opportunities/bulk-reassign
- Reasignación masiva a otro asesor.
- Bearer: sí
- Modifica datos

DELETE /opportunities/:id
- Elimina una oportunidad.
- Bearer: sí
- Modifica datos

---

## Clientes (vista comercial, `/clients`)

GET /clients
- Lista clientes (empresas en etapa cliente) con vista aplanada.
- Bearer: sí
- Solo lectura

PATCH /clients/:id
- Actualiza estado/notas de un cliente.
- Bearer: sí
- Modifica datos

---

## Actividades (`/activities`)

POST /activities
- Crea una actividad (llamada/tarea/reunión/correo/WhatsApp).
- Bearer: sí
- Modifica datos

GET /activities?page=1&limit=25
- Lista paginada con filtros (tipo, estado, fechas, entidades).
- Bearer: sí
- Solo lectura

GET /activities/:id
- Detalle de una actividad.
- Bearer: sí
- Solo lectura

PATCH /activities/:id
- Actualiza parcialmente una actividad.
- Bearer: sí
- Modifica datos

DELETE /activities/:id
- Elimina una actividad.
- Bearer: sí
- Modifica datos

---

## Historial de actividad (`/activity-logs`)

GET /activity-logs?page=1&limit=25
- Historial de acciones del sistema (filtros por usuario/módulo/entidad).
- Bearer: sí
- Solo lectura

---

## Auditoría de detalle (`/audit-detail`)

GET /audit-detail?page=1&limit=25
- Cambios auditados con detalle por campo (antes → después).
- Bearer: sí
- Solo lectura

---

## Notificaciones (`/notifications`)

GET /notifications?limit=100
- Notificaciones del usuario (sincroniza tareas vencidas).
- Bearer: sí
- Solo lectura

PATCH /notifications/read-all
- Marca todas las notificaciones como leídas.
- Bearer: sí
- Modifica datos

PATCH /notifications/:id/read
- Marca una notificación como leída.
- Bearer: sí
- Modifica datos

DELETE /notifications/:id
- Elimina una notificación.
- Bearer: sí
- Modifica datos

---

## Analítica / reportes (`/analytics`)

GET /analytics/kpis
- KPIs rápidos del dashboard en un rango.
- Bearer: sí
- Solo lectura

GET /analytics/summary
- KPIs y series completas (ventas, embudo, asesores).
- Bearer: sí
- Solo lectura

GET /analytics/goal-progress
- Progreso de metas de ventas (semana/mes, equipo vs asesor).
- Bearer: sí
- Solo lectura

GET /analytics/marketing/leads-by-week
- Leads y contactados por semana (área marketing).
- Bearer: sí
- Solo lectura

GET /analytics/advisor-funnel-movement/companies
- Empresas por bucket del movimiento del embudo por asesor.
- Bearer: sí
- Solo lectura

GET /analytics/activities-by-advisor/details
- Detalle de actividades completadas por asesor y semana.
- Bearer: sí
- Solo lectura

GET /analytics/tasks-by-advisor/details
- Detalle de tareas completadas por asesor y semana.
- Bearer: sí
- Solo lectura

---

## Copiloto IA (`/api/ai`) — rate limit 30 req/min

GET /api/ai/conversations
- Lista los hilos de chat del usuario.
- Bearer: sí
- Solo lectura

POST /api/ai/conversations
- Crea un hilo de chat vacío.
- Bearer: sí
- Modifica datos

GET /api/ai/conversations/:id
- Mensajes de un hilo.
- Bearer: sí
- Solo lectura

DELETE /api/ai/conversations/:id
- Elimina un hilo de chat.
- Bearer: sí
- Modifica datos

GET /api/ai/conversation
- Hilo más reciente del usuario (compatibilidad).
- Bearer: sí
- Solo lectura

DELETE /api/ai/conversation
- Borra el hilo más reciente (compatibilidad).
- Bearer: sí
- Modifica datos

GET /api/ai/assistant-instructions
- Instrucciones editables del copiloto.
- Bearer: sí
- Solo lectura

PATCH /api/ai/assistant-instructions
- Actualiza las instrucciones del copiloto.
- Bearer: sí
- Modifica datos

POST /api/ai/chat
- Chat del copiloto (respuesta completa + acciones).
- Bearer: sí
- Modifica datos

POST /api/ai/chat/stream
- Chat en vivo con respuesta streaming (SSE).
- Bearer: sí
- Modifica datos

---

## Bases de conocimiento (`/api/ai/knowledge-bases`) — rate limit 30 req/min

GET /api/ai/knowledge-bases
- Lista las bases de conocimiento del usuario.
- Bearer: sí
- Solo lectura

POST /api/ai/knowledge-bases
- Crea una base por texto/URL (no por subida).
- Bearer: sí
- Modifica datos

POST /api/ai/knowledge-bases/upload
- Crea una base subiendo archivos (multipart `files`).
- Bearer: sí
- Modifica datos

DELETE /api/ai/knowledge-bases/:id
- Elimina una base de conocimiento.
- Bearer: sí
- Modifica datos

---

## Import / Export (`/import-export`)

GET /import-export/jobs/:id
- Progreso de un job de importación.
- Bearer: sí
- Solo lectura

GET /import-export/contacts/template
- Descarga plantilla CSV de contactos.
- Bearer: sí
- Solo lectura

GET /import-export/contacts/export
- Exporta contactos a CSV.
- Bearer: sí
- Solo lectura

POST /import-export/contacts/preview
- Previsualiza CSV de contactos (no importa).
- Bearer: sí
- Solo lectura

POST /import-export/contacts/import
- Importa contactos desde CSV (job asíncrono).
- Bearer: sí
- Modifica datos

GET /import-export/companies/template
- Descarga plantilla CSV de empresas.
- Bearer: sí
- Solo lectura

GET /import-export/companies/export
- Exporta empresas a CSV comercial.
- Bearer: sí
- Solo lectura

POST /import-export/companies/preview
- Previsualiza CSV de empresas (no importa).
- Bearer: sí
- Solo lectura

POST /import-export/companies/import
- Importa empresas desde CSV (job asíncrono).
- Bearer: sí
- Modifica datos

GET /import-export/companies/template-fecha-ingreso
- Plantilla CSV de fecha de ingreso de empresas.
- Bearer: sí
- Solo lectura

POST /import-export/companies/import-fecha-ingreso
- Actualiza fecha de ingreso desde CSV (síncrono).
- Bearer: sí
- Modifica datos

GET /import-export/opportunities/template
- Descarga plantilla CSV de oportunidades.
- Bearer: sí
- Solo lectura

GET /import-export/opportunities/export
- Exporta oportunidades a CSV.
- Bearer: sí
- Solo lectura

POST /import-export/opportunities/import
- Importa oportunidades desde CSV (job asíncrono).
- Bearer: sí
- Modifica datos

---

## Archivos (`/files`)

GET /files
- Lista archivos por entidad/scope.
- Bearer: sí
- Solo lectura

POST /files
- Sube un archivo asociado a una entidad (multipart `file`).
- Bearer: sí
- Modifica datos

GET /files/:id/content
- Descarga/vista previa del archivo.
- Bearer: sí
- Solo lectura

GET /files/:id/url
- URL firmada de descarga del archivo.
- Bearer: sí
- Solo lectura

DELETE /files/:id
- Elimina un archivo.
- Bearer: sí
- Modifica datos

---

## Campañas y buzón (`/campaigns`)

GET /campaigns?page=1&limit=50
- Lista paginada de campañas (filtros status/channel/area).
- Bearer: sí
- Solo lectura

GET /campaigns/:id
- Detalle de una campaña.
- Bearer: sí
- Solo lectura

POST /campaigns
- Crea una campaña.
- Bearer: sí
- Modifica datos

POST /campaigns/send-email
- Envía un correo de campaña a destinatarios.
- Bearer: sí
- Modifica datos

PATCH /campaigns/:id
- Actualiza parcialmente una campaña.
- Bearer: sí
- Modifica datos

DELETE /campaigns/:id
- Elimina una campaña.
- Bearer: sí
- Modifica datos

GET /campaigns/mailbox?folder=inbox
- Lista hilos del buzón (inbox/sent).
- Bearer: sí
- Solo lectura

GET /campaigns/mailbox/threads/:id
- Detalle de un hilo del buzón.
- Bearer: sí
- Solo lectura

POST /campaigns/mailbox/threads/:id/reply
- Envía una respuesta a un hilo del buzón.
- Bearer: sí
- Modifica datos

GET /campaigns/mailbox/messages/:messageId/attachments/:attachmentId
- Descarga un adjunto de un mensaje del buzón.
- Bearer: sí
- Solo lectura

GET /campaigns/inbound?page=1&limit=50
- Emails entrantes registrados (webhook Resend).
- Bearer: sí
- Solo lectura

GET /campaigns/inbound/:id
- Detalle de un email entrante.
- Bearer: sí
- Solo lectura

POST /api/webhooks/resend
- Webhook Resend (eventos de correo entrante).
- Bearer: no (pública + firma Svix)
- Modifica datos

---

## WhatsApp Evolution (`/api/whatsapp`)

GET /api/whatsapp/connection/me
- Estado de la conexión WhatsApp del usuario.
- Bearer: sí
- Solo lectura

POST /api/whatsapp/connection/me/connect
- Inicia/vincula la conexión del usuario (QR).
- Bearer: sí
- Modifica datos

POST /api/whatsapp/connection/me/disconnect
- Desconecta la instancia del usuario.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/connection/me/test-message
- Envía un mensaje de prueba.
- Bearer: sí
- Modifica datos

GET /api/whatsapp/messages?contactId=...
- Mensajes de WhatsApp de un contacto.
- Bearer: sí
- Solo lectura

POST /api/whatsapp/send
- Envía un mensaje a un contacto/número.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/send-bulk
- Envío masivo a contactos (en segundo plano).
- Bearer: sí
- Modifica datos

GET /api/whatsapp/conversations
- Conversaciones de WhatsApp (búsqueda `?q=`).
- Bearer: sí
- Solo lectura

POST /api/whatsapp/import-excel
- Previsualiza destinatarios desde Excel (.xlsx).
- Bearer: sí
- Modifica datos

GET /api/whatsapp/media/proxy/:messageId
- Proxy público de media de Evolution.
- Bearer: no (pública)
- Solo lectura

GET /api/whatsapp/shared/connection
- Estado de la instancia compartida (Flota).
- Bearer: sí
- Solo lectura

POST /api/whatsapp/shared/connect
- Conecta la instancia compartida (QR).
- Bearer: sí
- Modifica datos

POST /api/whatsapp/shared/disconnect
- Desconecta la instancia compartida.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/shared/test
- Mensaje de prueba de la instancia compartida.
- Bearer: sí
- Modifica datos

GET /api/whatsapp/flota/instances
- Lista instancias de WhatsApp de la flota.
- Bearer: sí
- Solo lectura

POST /api/whatsapp/flota/instances
- Crea una instancia de flota.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/instances/:id/connect
- Dispara la conexión (QR) de una instancia.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/instances/:id/disconnect
- Desconecta una instancia.
- Bearer: sí
- Modifica datos

DELETE /api/whatsapp/flota/instances/:id
- Elimina una instancia.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/instances/:id/reconnect
- Reconecta una instancia.
- Bearer: sí
- Modifica datos

GET /api/whatsapp/flota/instances/:id/config
- Configuración de una instancia.
- Bearer: sí
- Solo lectura

PATCH /api/whatsapp/flota/instances/:id/config
- Actualiza configuración de una instancia.
- Bearer: sí
- Modifica datos

PATCH /api/whatsapp/flota/instances/:id/flags
- Ajusta flags de uso (inbox/masivo).
- Bearer: sí
- Modifica datos

GET /api/whatsapp/flota/prospectos/:id/messages
- Mensajes de WhatsApp de un prospecto de flota.
- Bearer: sí
- Solo lectura

POST /api/whatsapp/flota/link-prospecto
- Vincula los mensajes de un teléfono a un prospecto.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/send
- Envía mensaje desde una conversación de prospecto.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/read/:prospectoId
- Marca como leídos los mensajes de un prospecto.
- Bearer: sí
- Modifica datos

DELETE /api/whatsapp/flota/conversations/:id
- Elimina una conversación de flota.
- Bearer: sí
- Modifica datos

DELETE /api/whatsapp/flota/messages/:id
- Elimina un mensaje de flota.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/upload-image
- Sube imagen para WhatsApp (convierte a WebP).
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/upload-audio
- Sube audio para WhatsApp.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/upload-document
- Sube documento para WhatsApp.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/send-bulk
- Envío masivo a prospectos de flota.
- Bearer: sí
- Modifica datos

GET /api/whatsapp/flota/bulk-campaigns
- Campañas/envíos masivos de flota.
- Bearer: sí
- Solo lectura

GET /api/whatsapp/flota/send-bulk/:jobId
- Progreso de un job de envío masivo.
- Bearer: sí
- Solo lectura

DELETE /api/whatsapp/flota/send-bulk/:jobId
- Cancela un job de envío masivo.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/send-bulk/:jobId/pause
- Pausa un job de envío masivo.
- Bearer: sí
- Modifica datos

POST /api/whatsapp/flota/send-bulk/:jobId/resume
- Reanuda un job pausado.
- Bearer: sí
- Modifica datos

POST /api/webhooks/evolution-go?token=...
- Webhook Evolution GO (mensajes/QR/estado).
- Bearer: no (pública + token en query)
- Modifica datos

---

## WhatsApp Cloud API (`/whatsapp-cloud`)

POST /whatsapp-cloud/connect
- Conecta una cuenta de WhatsApp Cloud API.
- Bearer: sí
- Modifica datos

POST /whatsapp-cloud/test-connection
- Prueba conexión de una cuenta (no la guarda).
- Bearer: sí
- Solo lectura

GET /whatsapp-cloud/accounts
- Lista cuentas conectadas del usuario.
- Bearer: sí
- Solo lectura

DELETE /whatsapp-cloud/accounts/:id
- Desconecta/elimina una cuenta.
- Bearer: sí
- Modifica datos

PATCH /whatsapp-cloud/accounts/:id/token
- Actualiza el access token de una cuenta.
- Bearer: sí
- Modifica datos

POST /whatsapp-cloud/accounts/:id/default
- Define la cuenta predeterminada.
- Bearer: sí
- Modifica datos

POST /whatsapp-cloud/accounts/:id/test-connection
- Prueba conexión de una cuenta guardada.
- Bearer: sí
- Solo lectura

POST /whatsapp-cloud/accounts/:id/sync-templates
- Sincroniza plantillas desde la API de Meta.
- Bearer: sí
- Modifica datos

GET /whatsapp-cloud/templates?accountId=...
- Lista plantillas de una cuenta.
- Bearer: sí
- Solo lectura

PATCH /whatsapp-cloud/templates/:id/daily-limit
- Ajusta el límite diario de envío de una plantilla.
- Bearer: sí
- Modifica datos

GET /whatsapp-cloud/campaigns
- Lista campañas de WhatsApp Cloud.
- Bearer: sí
- Solo lectura

POST /whatsapp-cloud/campaigns
- Crea una campaña (inmediata o programada).
- Bearer: sí
- Modifica datos

GET /whatsapp-cloud/campaigns/:id
- Detalle de una campaña.
- Bearer: sí
- Solo lectura

POST /whatsapp-cloud/campaigns/:id/send
- Inicia el envío de una campaña.
- Bearer: sí
- Modifica datos

---

## Chatwoot (`/api/chatwoot`)

GET /api/chatwoot/conversations
- Lista conversaciones (filtros status/q/inbox).
- Bearer: sí
- Solo lectura

GET /api/chatwoot/conversations/search
- Busca conversaciones por texto.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/conversations/:id
- Detalle de una conversación.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/conversations/:id/messages
- Mensajes de una conversación.
- Bearer: sí
- Solo lectura

POST /api/chatwoot/conversations/:id/messages
- Envía un mensaje de texto a la conversación.
- Bearer: sí
- Modifica datos

POST /api/chatwoot/conversations/:id/messages/template
- Envía una plantilla WhatsApp a la conversación.
- Bearer: sí
- Modifica datos

PATCH /api/chatwoot/conversations/:id
- Actualiza estado y/o agente asignado.
- Bearer: sí
- Modifica datos

POST /api/chatwoot/conversations/:id/read
- Marca la conversación como leída.
- Bearer: sí
- Modifica datos

POST /api/chatwoot/conversations/:id/sync-operador
- Sincroniza el operador asignado desde Chatwoot.
- Bearer: sí
- Modifica datos

POST /api/chatwoot/conversations/:id/upload
- Sube un adjunto (base64) a la conversación.
- Bearer: sí
- Modifica datos

POST /api/chatwoot/initiate-conversation
- Inicia conversación de WhatsApp con plantilla.
- Bearer: sí
- Modifica datos

GET /api/chatwoot/resolve-conversation
- Resuelve una conversación por teléfono.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/unread-summary
- Resumen de no leídas por agente/inbox.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/contacts?q=...
- Busca contactos.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/contacts-list
- Lista paginada de contactos.
- Bearer: sí
- Solo lectura

POST /api/chatwoot/contacts
- Crea un contacto en Chatwoot.
- Bearer: sí
- Modifica datos

PATCH /api/chatwoot/contacts/:id
- Actualiza un contacto.
- Bearer: sí
- Modifica datos

GET /api/chatwoot/contacts/:id/conversations
- Conversaciones de un contacto.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/inboxes
- Lista los inboxes de Chatwoot.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/agents
- Lista los agentes de Chatwoot.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/config
- Estado/configuración de la integración.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/templates
- Plantillas disponibles para enviar.
- Bearer: sí
- Solo lectura

GET /api/chatwoot/content?url=...
- Proxy público de media de Chatwoot.
- Bearer: no (pública)
- Solo lectura

GET /api/chatwoot/test-emit
- Emite un evento de prueba por Socket.IO.
- Bearer: no (pública)
- Modifica datos

POST /api/chatwoot/webhook
- Webhook Chatwoot (sincroniza prospectos/mensajes).
- Bearer: no (pública)
- Modifica datos

---

## Gmail (`/gmail`)

GET /gmail/profile
- Perfil/estado de la cuenta Gmail conectada.
- Bearer: sí
- Solo lectura

GET /gmail/messages
- Lista mensajes de Gmail.
- Bearer: sí
- Solo lectura

GET /gmail/messages/:id
- Detalle de un mensaje.
- Bearer: sí
- Solo lectura

GET /gmail/threads/:id
- Detalle de un hilo.
- Bearer: sí
- Solo lectura

POST /gmail/threads/:id/read
- Marca un hilo como leído.
- Bearer: sí
- Modifica datos

POST /gmail/threads/:id/unread
- Marca un hilo como no leído.
- Bearer: sí
- Modifica datos

POST /gmail/threads/:id/star
- Marca/desmarca el hilo con estrella.
- Bearer: sí
- Modifica datos

POST /gmail/threads/:id/archive
- Archiva un hilo.
- Bearer: sí
- Modifica datos

POST /gmail/threads/:id/trash
- Mueve un hilo a la papelera.
- Bearer: sí
- Modifica datos

GET /gmail/messages/:messageId/attachments/:attachmentId
- Descarga un adjunto.
- Bearer: sí
- Solo lectura

POST /gmail/send
- Envía un correo por Gmail.
- Bearer: sí
- Modifica datos

POST /gmail/link
- Vincula un correo saliente al CRM.
- Bearer: sí
- Modifica datos

GET /gmail/register-activity/preview
- Previsualiza el registro de una actividad desde un correo.
- Bearer: sí
- Solo lectura

POST /gmail/register-activity
- Registra un correo como actividad CRM.
- Bearer: sí
- Modifica datos

GET /gmail/signature
- Obtiene la firma HTML del usuario.
- Bearer: sí
- Solo lectura

PUT /gmail/signature
- Guarda la firma HTML.
- Bearer: sí
- Modifica datos

DELETE /gmail/signature
- Elimina la firma (y su imagen).
- Bearer: sí
- Modifica datos

GET /gmail/signature/image
- Imagen de la firma.
- Bearer: sí
- Solo lectura

POST /gmail/signature/image
- Sube la imagen de la firma.
- Bearer: sí
- Modifica datos

GET /gmail/sender-avatar?from=...
- Avatar del remitente por email.
- Bearer: no (pública)
- Solo lectura

---

## Google Calendar / Tasks (`/google-calendar`)

GET /google-calendar/events
- Lista eventos del calendario.
- Bearer: sí
- Solo lectura

POST /google-calendar/events
- Crea un evento.
- Bearer: sí
- Modifica datos

PATCH /google-calendar/events/:id
- Actualiza un evento.
- Bearer: sí
- Modifica datos

DELETE /google-calendar/events/:id
- Elimina un evento.
- Bearer: sí
- Modifica datos

GET /google-calendar/tasklists
- Lista listas de Google Tasks.
- Bearer: sí
- Solo lectura

POST /google-calendar/tasks
- Crea una tarea en Google Tasks.
- Bearer: sí
- Modifica datos

POST /google-calendar/link
- Vincula un evento con asistentes a un usuario CRM.
- Bearer: sí
- Modifica datos

---

## Cartera de clientes (`/cliente-cartera`)

GET /cliente-cartera/analytics/summary
- KPIs de la cartera (empresas, ingresos, tareas).
- Bearer: sí
- Solo lectura

GET /cliente-cartera/empresas
- Lista empresas de la cartera.
- Bearer: sí
- Solo lectura

GET /cliente-cartera/empresas/:id
- Detalle de una empresa de la cartera.
- Bearer: sí
- Solo lectura

POST /cliente-cartera/empresas/refresh
- Sincroniza empresas desde Taxi Monterrico.
- Bearer: sí
- Modifica datos

POST /cliente-cartera/sync
- Alias de refresh (botón Sincronizar).
- Bearer: sí
- Modifica datos

POST /cliente-cartera/empresas/:id/contactos
- Vincula un contacto a una empresa de la cartera.
- Bearer: sí
- Modifica datos

DELETE /cliente-cartera/empresas/:empresaId/contactos/:contactoId
- Desvincula un contacto de una empresa.
- Bearer: sí
- Modifica datos

GET /cliente-cartera/contactos
- Lista contactos de la cartera.
- Bearer: sí
- Solo lectura

GET /cliente-cartera/contactos/:id
- Detalle de un contacto de la cartera.
- Bearer: sí
- Solo lectura

POST /cliente-cartera/contactos
- Crea un contacto de cartera.
- Bearer: sí
- Modifica datos

PATCH /cliente-cartera/contactos/:id
- Actualiza un contacto de cartera.
- Bearer: sí
- Modifica datos

DELETE /cliente-cartera/contactos/:id
- Elimina un contacto de cartera.
- Bearer: sí
- Modifica datos

---

## Facebook / Instagram leads (`/facebook`)

POST /facebook/connect
- Conecta una página de Facebook.
- Bearer: sí
- Modifica datos

GET /facebook/accounts
- Lista cuentas/páginas conectadas.
- Bearer: sí
- Solo lectura

DELETE /facebook/accounts/:id
- Desconecta una cuenta.
- Bearer: sí
- Modifica datos

POST /facebook/accounts/:id/sync-forms
- Sincroniza los lead forms de la página.
- Bearer: sí
- Modifica datos

POST /facebook/accounts/:id/sync-leads
- Sincroniza leads hacia BD.
- Bearer: sí
- Modifica datos

GET /facebook/leads
- Listado paginado de leads.
- Bearer: sí
- Solo lectura

GET /facebook/stats
- Estadísticas globales de leads.
- Bearer: sí
- Solo lectura

GET /facebook/forms
- Formularios de cuentas activas.
- Bearer: sí
- Solo lectura

POST /facebook/leads/bulk-preview
- Previsualiza importación masiva a flota/comercial.
- Bearer: sí
- Solo lectura

POST /facebook/leads/bulk-send
- Importa masivamente leads a flota/comercial.
- Bearer: sí
- Modifica datos

POST /facebook/leads/bulk-delete
- Elimina masivamente leads.
- Bearer: sí
- Modifica datos

DELETE /facebook/leads/:id
- Elimina un lead.
- Bearer: sí
- Modifica datos

GET /facebook/leads/:id/preview-import
- Previsualiza conversión de un lead.
- Bearer: sí
- Solo lectura

POST /facebook/leads/:id/send-to-comercial
- Envía el lead a Comercial (contacto/empresa/oportunidad).
- Bearer: sí
- Modifica datos

POST /facebook/leads/:id/send-to-flota
- Envía el lead a Flota (prospecto).
- Bearer: sí
- Modifica datos

GET /api/webhooks/facebook
- Handshake de verificación del webhook de Facebook.
- Bearer: no (pública + token verify)
- Solo lectura

POST /api/webhooks/facebook
- Webhook de eventos leadgen de Facebook.
- Bearer: no (pública)
- Modifica datos

---

## Flota de prospectos (`/flota-prospectos`)

GET /flota-prospectos?page=1&limit=25
- Listado paginado de prospectos con filtros.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/operadores
- Lista operadores activos.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/counts
- Conteos globales (estado, duplicados, red social).
- Bearer: sí
- Solo lectura

GET /flota-prospectos/operador-stats?fecini=...&fecfin=...
- Estadísticas por operador en un rango.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/operador-stats/daily?fecini=...&fecfin=...
- Desglose diario por operador.
- Bearer: sí
- Solo lectura

POST /flota-prospectos/operador-stats/backfill
- Reconstruye el historial diario de operadores.
- Bearer: sí
- Modifica datos

POST /flota-prospectos/operador-stats/snapshot
- Genera snapshot diario de estadísticas.
- Bearer: sí
- Modifica datos

GET /flota-prospectos/masivo-list
- Lista ligera para envío masivo.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/by-phone/:phone
- Busca un prospecto por celular.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/calendario-citas
- Prospectos con cita programada.
- Bearer: sí
- Solo lectura

POST /flota-prospectos
- Crea un prospecto (409 si ya existe el teléfono).
- Bearer: sí
- Modifica datos

GET /flota-prospectos/:id
- Detalle de un prospecto.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/:id/con-archivos
- Prospecto con sus archivos (expediente).
- Bearer: sí
- Solo lectura

PATCH /flota-prospectos/:id
- Actualiza un prospecto.
- Bearer: sí
- Modifica datos

PATCH /flota-prospectos/:id/operador
- Asigna/desasigna operador.
- Bearer: sí
- Modifica datos

DELETE /flota-prospectos/:id
- Elimina (soft delete) un prospecto.
- Bearer: sí
- Modifica datos

POST /flota-prospectos/delete-many
- Elimina múltiples prospectos.
- Bearer: sí
- Modifica datos

GET /flota-prospectos/:id/llamadas
- Llamadas registradas de un prospecto.
- Bearer: sí
- Solo lectura

POST /flota-prospectos/:id/llamadas
- Registra una llamada.
- Bearer: sí
- Modifica datos

GET /flota-prospectos/:id/archivos
- Archivos del expediente.
- Bearer: sí
- Solo lectura

POST /flota-prospectos/:id/archivos
- Sube un archivo al expediente.
- Bearer: sí
- Modifica datos

DELETE /flota-prospectos/:id/archivos/:fileId
- Elimina un archivo del expediente.
- Bearer: sí
- Modifica datos

GET /flota-prospectos/:id/archivos/:fileId/content
- Stream/descarga del archivo.
- Bearer: sí
- Solo lectura

GET /flota-prospectos/:id/archivos/:fileId/url
- URL firmada del archivo.
- Bearer: sí
- Solo lectura

GET /flota/spreadsheets
- Spreadsheets de Google configurados.
- Bearer: no (pública)
- Solo lectura

GET /flota/sheets
- Hojas de un spreadsheet.
- Bearer: no (pública)
- Solo lectura

GET /flota/preview/:sheetName
- Vista previa de una hoja.
- Bearer: no (pública)
- Solo lectura

POST /flota/import-rows
- Importa prospectos desde filas (job).
- Bearer: sí
- Modifica datos

POST /flota/import/:sheetName
- Importa prospectos desde Google Sheets (job).
- Bearer: sí
- Modifica datos

POST /api/webhooks/flota-prospecto
- Landing de registro de conductores (crea/reactiva prospecto).
- Bearer: no (pública + API key x-api-key)
- Modifica datos

POST /api/flow/registro-prospecto?token=...
- Webhook Flow (bot/WhatsApp) con archivos adjuntos.
- Bearer: no (pública + token en query)
- Modifica datos

---

## Web leads (landing, `/api/webhooks/web-leads`)

POST /api/webhooks/web-leads
- Captura leads de la web (crea contacto/empresa/oportunidad).
- Bearer: no (pública + API key x-api-key)
- Modifica datos

---

## Apollo.io (`/apollo`)

POST /apollo/search
- Busca personas en Apollo.
- Bearer: sí
- Solo lectura

POST /apollo/companies/search
- Busca empresas en Apollo.
- Bearer: sí
- Solo lectura

POST /apollo/organizations/enrich
- Enriquece una organización por dominio.
- Bearer: sí
- Solo lectura

POST /apollo/match
- Empareja personas a partir de emails.
- Bearer: sí
- Solo lectura

POST /apollo/people/enrich
- Enriquece una persona por id.
- Bearer: sí
- Solo lectura

---

## Factiliza / RUC-SUNAT (`/factiliza`)

GET /factiliza/ruc/:ruc
- Consulta datos de una empresa por RUC.
- Bearer: sí
- Solo lectura

---

## Estado / health

GET /
- Estado básico de la API.
- Bearer: no (pública)
- Solo lectura

*Guía generada desde los controladores de `backend/src`. Los permisos por rol aplican por módulo (patrón `entidad.accion`); los detalles completos, ejemplos de respuesta y parámetros por endpoint están en `git history`/código fuente.*




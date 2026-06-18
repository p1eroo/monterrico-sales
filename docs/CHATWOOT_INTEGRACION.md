# Plan: Integración Chatwoot en el CRM

## Objetivo

Consumir la API de Chatwoot (self-hosted) para que el CRM funcione como frontend del buzón de Flota, permitiendo ver conversaciones, contactos y mensajes, y responder desde la misma interfaz.

## Arquitectura

```
CRM (Monterrico Sales) ←→ API Chatwoot ←→ WhatsApp (Evolution GO / Meta)
                              ↕
                    Manychat (AI agents, temporal)
```

Chatwoot sigue siendo el orquestador central. Nuestro CRM se conecta a su API para leer y escribir conversaciones. Manychat se mantiene hasta que implementemos nuestros propios AI agents.

## Conexión

| Dato | Valor |
|------|-------|
| Base URL | `https://contacto.taximonterrico.com` |
| Account ID | `14` |
| Inbox ID (Flota) | `45` |
| API base | `https://contacto.taximonterrico.com/api/v1/accounts/14/` |
| Auth | `api_access_token` (generado en Settings → API → Access Token) |

---

## Paso 1: Backend — Módulo Chatwoot

### 1.1 Configuración (`backend/.env`)

```env
CHATWOOT_BASE_URL=https://contacto.taximonterrico.com
CHATWOOT_ACCOUNT_ID=14
CHATWOOT_API_TOKEN=token_generado
CHATWOOT_INBOX_ID=45
CHATWOOT_WEBHOOK_SECRET=clave_secreta_opcional
```

### 1.2 Estructura del módulo

```
backend/src/chatwoot/
├── chatwoot.module.ts
├── chatwoot.client.ts            # Cliente HTTP para Chatwoot REST API
├── chatwoot.service.ts           # Lógica de negocio
├── chatwoot.controller.ts        # Endpoints para el frontend
├── chatwoot-webhook.controller.ts # Webhooks desde Chatwoot
├── chatwoot.gateway.ts           # Socket.IO para tiempo real
└── chatwoot.types.ts             # Tipos compartidos
```

### 1.3 ChatwootClient — Endpoints de Chatwoot a consumir

| Recurso | Endpoint Chatwoot | Uso |
|---------|------------------|-----|
| **Conversaciones** | `GET /api/v1/accounts/{id}/conversations` | Listar con filtros (status, assignee, q) |
| | `GET /api/v1/accounts/{id}/conversations/{cid}` | Detalle de conversación |
| **Mensajes** | `GET /api/v1/accounts/{id}/conversations/{cid}/messages` | Paginado, trae mensajes |
| | `POST /api/v1/accounts/{id}/conversations/{cid}/messages` | Enviar mensaje (text, image, file) |
| **Contactos** | `GET /api/v1/accounts/{id}/contacts` | Buscar por teléfono/nombre |
| | `POST /api/v1/accounts/{id}/contacts` | Crear contacto |
| | `PATCH /api/v1/accounts/{id}/contacts/{contactId}` | Actualizar |
| | `GET /api/v1/accounts/{id}/contacts/{contactId}/conversations` | Conversaciones del contacto |
| **Inboxes** | `GET /api/v1/accounts/{id}/inboxes` | Listar buzones |
| **Agentes** | `GET /api/v1/accounts/{id}/agents` | Listar agentes |
| **Etiquetas** | `POST /api/v1/accounts/{id}/conversations/{cid}/labels` | Agregar labels |
| **Conversación** | `PATCH /api/v1/accounts/{id}/conversations/{cid}` | Cambiar status (open/resolved/pending) y assignee |

### 1.4 Endpoints que expone nuestro backend al frontend

```
GET    /api/chatwoot/conversations?status=open&q=
GET    /api/chatwoot/conversations/:id
GET    /api/chatwoot/conversations/:id/messages?before=
POST   /api/chatwoot/conversations/:id/messages    { content, message_type, attachments? }
GET    /api/chatwoot/contacts?q=
POST   /api/chatwoot/contacts                      { name, phone, email, ... }
GET    /api/chatwoot/inboxes
GET    /api/chatwoot/agents
PATCH  /api/chatwoot/conversations/:id              { status, assignee_id }
```

### 1.5 Webhooks desde Chatwoot

Chatwoot envía POST a nuestra URL. Eventos a manejar:

| Evento | Acción |
|--------|--------|
| `conversation_created` | Notificar al frontend via Socket.IO |
| `message_created` | Agregar a caché local + emitir Socket.IO |
| `message_updated` | Actualizar mensaje |
| `conversation_status_changed` | Actualizar badge/estado en UI |
| `contact_created` | Buscar número en FlotaProspecto y vincular |
| `contact_updated` | Sincronizar datos |
| `assignee_changed` | Actualizar UI |

Endpoint webhook: `POST /api/chatwoot/webhook`

### 1.6 Socket.IO

Namespace `/chatwoot` (o reutilizar el existente `/whatsapp` agregando un event type `chatwoot`).

Eventos emitidos al frontend:

```typescript
// Nuevo mensaje entrante
{ type: 'chatwoot', event: 'message_created', conversationId, message }

// Cambio de estado
{ type: 'chatwoot', event: 'conversation_status_changed', conversationId, status }

// Nueva conversación
{ type: 'chatwoot', event: 'conversation_created', conversation }
```

### 1.7 Prisma — Modelos

```prisma
// En FlotaProspecto existente, agregar:
// chatwootContactId     Int?    // ID del contacto en Chatwoot
// chatwootConversationId Int?   // ID de la conversación activa

// Opcional: tabla de configuración
model ChatwootSettings {
  id            String  @id @default(cuid())
  baseUrl       String
  apiToken      String
  accountId     Int
  inboxId       Int?
  enabled       Boolean @default(true)
  lastSyncAt    DateTime?
}
```

### 1.8 Sincronización contactos

Cuando llegue un webhook `message_created` o `conversation_created`:
1. Extraer el número de teléfono del remitente
2. Buscar en `FlotaProspecto` por ese número
3. Si existe → guardar `chatwootContactId` en el prospecto
4. Si no existe → crear `FlotaProspecto` nuevo (misma lógica que Evolution GO)
5. Asociar la conversación

---

## Paso 2: Frontend — ChatwootInboxView

### 2.1 UI en FlotaMensajes

Agregar pestaña **Chatwoot** en la barra lateral izquierda:

```
[Inbox] [Chatwoot] [Calendario] [Masivo] [Pipeline] [Conexiones] [Automatización]
```

### 2.2 Componente ChatwootInboxView

Reutiliza la misma estructura que `InboxView` pero con fuente de datos distinta:

```
ChatwootInboxView
├── Sidebar (lista de conversaciones)
│   ├── Virtualizer (TanStack Virtual)
│   ├── Filtros: Todos | Abiertos | Resueltos
│   ├── Búsqueda por nombre/teléfono
│   └── Badge de no leídos
├── ChatPanel
│   ├── Burbujas de mensaje (reutilizar MessageAttachment)
│   ├── Input con emoji + adjuntos + audio
│   └── Indicador de "escribiendo..."
├── Header
│   ├── Nombre del contacto
│   ├── Estado de la conversación
│   ├── Badge de inbox (Flota)
│   └── Botón de info del prospecto
└── Panel lateral
    ├── Editar prospecto (reutilizar)
    └── Archivos del chat (reutilizar)
```

### 2.3 API calls desde el frontend

Usando `api<T>()` de `@/lib/api.ts`:

```typescript
// lib/chatwootApi.ts
fetchChatwootConversations(params?)   → GET /api/chatwoot/conversations
fetchChatwootMessages(convId, before?) → GET /api/chatwoot/conversations/:id/messages
sendChatwootMessage(convId, content)   → POST /api/chatwoot/conversations/:id/messages
fetchChatwootContacts(query?)          → GET /api/chatwoot/contacts
fetchChatwootInboxes()                 → GET /api/chatwoot/inboxes
fetchChatwootAgents()                  → GET /api/chatwoot/agents
updateChatwootConversation(cid, data)  → PATCH /api/chatwoot/conversations/:id
```

### 2.4 Socket.IO en ChatwootInboxView

```typescript
const socket = io(`${API_BASE}/chatwoot`, { auth: { token } });
// o reutilizar el socket existente de whatsapp namespace
socket.on('chatwoot', (payload) => {
  if (payload.event === 'message_created') {
    // agregar a caché local
  }
  // etc.
});
```

### 2.5 Flujo completo de respuesta

1. Usuario escribe mensaje + click Send
2. Optimistic update en la UI (igual que Evolution GO)
3. `POST /api/chatwoot/conversations/:id/messages` → nuestro backend
4. Backend hace `POST /api/v1/accounts/14/conversations/{cid}/messages` → Chatwoot
5. Chatwoot envía el mensaje a WhatsApp via su conector
6. Chatwoot nos envía webhook `message_created` → Socket.IO → actualizamos cache con el ID real

---

## Paso 3: Configuración inicial

### 3.1 En Chatwoot (UI)

1. Settings → Inboxes → [Flota inbox 45] → Configuration → Webhook
2. Agregar: `https://nuestro-backend.com/api/chatwoot/webhook`
3. Seleccionar eventos: conversation_created, message_created, message_updated, conversation_status_changed, contact_created, contact_updated, assignee_changed

### 3.2 En nuestro backend

1. Agregar variables de entorno
2. Probar conexión con `GET /api/v1/accounts/14/inboxes` usando el token
3. Verificar que lleguen los webhooks

---

## Archivos a crear/modificar

### Backend (nuevos)

| Archivo | Propósito |
|---------|-----------|
| `src/chatwoot/chatwoot.module.ts` | Módulo NestJS |
| `src/chatwoot/chatwoot.client.ts` | Cliente HTTP |
| `src/chatwoot/chatwoot.service.ts` | Lógica de negocio |
| `src/chatwoot/chatwoot.controller.ts` | Endpoints REST |
| `src/chatwoot/chatwoot-webhook.controller.ts` | Webhook handler |
| `src/chatwoot/chatwoot.gateway.ts` | Socket.IO gateway |
| `src/chatwoot/chatwoot.types.ts` | Tipos |

### Backend (modificar)

| Archivo | Cambio |
|---------|--------|
| `src/app.module.ts` | Importar ChatwootModule |
| `prisma/schema.prisma` | Agregar chatwootContactId y chatwootConversationId a FlotaProspecto |
| `.env` | Agregar variables CHATWOOT_* |

### Frontend (nuevos)

| Archivo | Propósito |
|---------|-----------|
| `src/lib/chatwootApi.ts` | API calls |
| `src/pages/flota/components/ChatwootInboxView.tsx` | Vista principal del inbox Chatwoot |
| `src/pages/flota/components/ChatwootConversationItem.tsx` | Item de conversación |
| `src/pages/flota/components/ChatwootChatPanel.tsx` | Panel de chat |

### Frontend (modificar)

| Archivo | Cambio |
|---------|--------|
| `src/pages/flota/FlotaMensajes.tsx` | Agregar tab "Chatwoot" y ruteo al ChatwootInboxView |

---

## Esfuerzo estimado

| Paso | Días |
|------|------|
| Backend: ChatwootClient + Service + Controller | 2 |
| Backend: Webhook + Socket.IO | 1 |
| Backend: Sincronización contactos | 1 |
| Frontend: ChatwootInboxView + ChatPanel | 2 |
| Frontend: Integración en FlotaMensajes | 1 |
| Pruebas + ajustes | 1 |
| **Total** | **~8 días** |

---

## Riesgos

- **Token API expira?** Los tokens de Chatwoot no expiran a menos que se regeneren manualmente
- **Rendimiento de Chatwoot self-hosted?** Depende de los recursos del servidor. Si es lento, podemos cachear conversaciones localmente
- **Webhook no llega?** Chatwoot reintenta automáticamente. Podemos tener polling como fallback
- **Manychat sigue funcionando?** Sí, Manychat está del lado de Chatwoot, no del nuestro. Nosotros solo consumimos la API

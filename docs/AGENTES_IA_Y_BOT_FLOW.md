# Plan: Agentes IA + Bot Flow (Reemplazar Manychat)

## Objetivo

Implementar un sistema propio de agentes IA conversacionales que reemplace a Manychat, integrado con Chatwoot y con capacidad de flujos visuales (Bot Flow Builder).

## Arquitectura General

```
Usuario WhatsApp
    ↓
Chatwoot (inbox Flota)
    ↓ Webhook
Nuestro Backend (NestJS)
    ├── Router (clasificador de intención)
    │   ├── → Agente específico (instrucciones + KBs)
    │   └── → Flujo visual (Bot Flow)
    ├── AI Engine (OpenAI + RAG + Tools)
    ├── Chatwoot API (envía respuesta)
    └── Socket.IO (tiempo real al frontend)
```

El ciclo completo:

1. Mensaje entra por WhatsApp → Chatwoot
2. Chatwoot envía webhook `message_created` → nuestro backend
3. Router decide: ¿agente IA o flujo visual?
4. AI procesa (contexto, RAG, herramientas CRM) → genera respuesta
5. Backend envía respuesta via API de Chatwoot
6. Usuario recibe respuesta en WhatsApp

---

## Fase 1: Backend — Modelo de Agentes

### 1.1 Modelo Prisma

```prisma
model AiAgent {
  id              String   @id @default(cuid())
  name            String
  description     String?
  instructions    String   // System prompt específico del agente
  model           String   @default("gpt-4o-mini")
  temperature     Float    @default(0.7)
  maxTokens       Int      @default(1024)
  status          String   @default("draft") // draft | active | paused
  confidenceFloor Float    @default(0.6)
  version         Int      @default(1)
  tags            String[] // Para categorización

  knowledgeBaseIds String[] // IDs de AiKnowledgeBase asociadas
  inboxId          Int?     // Inbox de Chatwoot al que responde

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  userId          String   // Quién lo creó
  user            User     @relation(fields: [userId], references: [id])
}

model AiRouterRule {
  id              String   @id @default(cuid())
  name            String
  description     String?
  priority        Int      @default(0)
  conditions      Json     // Array de condiciones: [{field, operator, value}]
  targetAgentId   String?
  targetAgent     AiAgent? @relation(fields: [targetAgentId], references: [id])
  targetFlowId    String?  // Si deriva a un Bot Flow
  isDefault       Boolean  @default(false) // Catch-all si ninguna regla matchea
  status          String   @default("active") // active | paused

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}

model AiConversation {
  id              String   @id @default(cuid())
  userId          String
  agentId         String?  // Qué agente está manejando esta conversación
  chatwootConvId  Int?     // ID de la conversación en Chatwoot
  // ... campos existentes ...
}
```

### 1.2 Endpoints de Agentes

```
GET    /api/ai/agents              → Listar agentes
POST   /api/ai/agents              → Crear agente { name, instructions, model, temperature, ... }
GET    /api/ai/agents/:id          → Detalle
PATCH  /api/ai/agents/:id          → Actualizar
DELETE /api/ai/agents/:id          → Eliminar

GET    /api/ai/routes              → Listar reglas de ruteo
POST   /api/ai/routes              → Crear regla
PATCH  /api/ai/routes/:id          → Actualizar
DELETE /api/ai/routes/:id          → Eliminar
```

### 1.3 Router de Intención

Servicio que recibe un mensaje y decide qué agente o flujo debe responder:

```typescript
class AiRouterService {
  async route(conversationId: string, message: string): Promise<RouteResult> {
    // 1. Evaluar reglas por orden de prioridad
    // 2. Condiciones disponibles:
    //    - message_contains: texto contenido en el mensaje
    //    - message_matches: regex
    //    - intent_classification: usar LLM para clasificar intención
    //    - contact_field: si el contacto tiene cierto campo
    //    - conversation_history: basado en mensajes anteriores
    // 3. Si hay match → devolver agentId o flowId
    // 4. Si no hay match → default agent o human handoff
  }
}
```

---

## Fase 2: Backend — Refactor del AI Service

### 2.1 Cambios en AiService

El servicio actual está hardcodeado a un solo assistant. Cambios:

| Feature | Actual | Futuro |
|---------|--------|--------|
| System prompt | Fijo + instructions editables | Por agente (cada uno con sus propias instrucciones) |
| Knowledge bases | Todas las del usuario | Solo las vinculadas al agente |
| Tools disponibles | 13 fijas | Configurables por agente |
| Contexto | User + página actual | + historial de Chatwoot, + datos del contacto |
| Streaming | Sí | Sí, por agente |

### 2.2 Tools configurables por agente

```typescript
const AGENT_TOOLS = {
  comercial: [
    'list_my_tasks',
    'get_company_summary',
    'list_my_recent_contacts',
    'search_my_knowledge',
    // ...
  ],
  soporte: [
    'search_my_knowledge',
    'get_company_summary',
    // ...
  ],
  flota: [
    'search_flota_prospectos',
    'update_flota_estado',
    // ...
  ],
};
```

### 2.3 Chatwoot Context

Al procesar un mensaje desde Chatwoot, inyectar contexto adicional:

```typescript
{
  chatwootConversationId: 123,
  contactName: 'Juan Pérez',
  contactPhone: '51987654321',
  conversationHistory: [... últimos 20 mensajes ...],
  crmData: { ... datos del FlotaProspecto vinculado ... }
}
```

---

## Fase 3: Backend — Bot Flow Engine

### 3.1 Modelos Prisma para Flujos

```prisma
model BotFlow {
  id          String   @id @default(cuid())
  name        String
  description String?
  status      String   @default("draft") // draft | active | paused
  agentId     String?  // Agente IA asociado (si brainMode incluye AI)
  brainMode   String   @default("flow_only") // flow_only | flow_with_ai | ai_agent
  userId      String
  user        User     @relation(fields: [userId], references: [id])

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model BotFlowNode {
  id          String   @id @default(cuid())
  flowId      String
  flow        BotFlow  @relation(fields: [flowId], references: [id])
  type        String   // start | message | question | condition | ai_extract | crm_action | human_handoff | end
  position    Json     // { x, y } para React Flow
  config      Json     // Config específica del tipo de nodo
  // Ejemplos de config:
  // message: { text: "Hola, ¿cómo estás?" }
  // question: { field: "edad", prompt: "¿Cuántos años tienes?" }
  // condition: { field: "edad", operator: ">=", value: "18" }
  // crm_action: { action: "update_contact", field: "estado", value: "Seguimiento" }

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model BotFlowEdge {
  id        String @id @default(cuid())
  flowId    String
  nodeId    String
  targetNodeId String
  label     String? // Para edges condicionales: "Sí", "No"
}
```

### 3.2 Endpoints de Bot Flow

```
GET    /api/bot-flows                    → Listar flujos
POST   /api/bot-flows                    → Crear flujo
GET    /api/bot-flows/:id                → Detalle con nodos y edges
PATCH  /api/bot-flows/:id                → Actualizar metadatos
DELETE /api/bot-flows/:id                → Eliminar

POST   /api/bot-flows/:id/nodes          → Agregar/quitar nodos (batch)
POST   /api/bot-flows/:id/edges          → Agregar/quitar edges (batch)
PATCH  /api/bot-flows/:id/status         → Activar/pausar flujo

GET    /api/bot-flows/:id/logs           → Logs de ejecución
GET    /api/bot-flows/:id/stats          → Estadísticas del flujo
```

### 3.3 Flow Engine

Servicio que ejecuta un flujo paso a paso:

```typescript
class BotFlowEngine {
  async processMessage(
    flowId: string,
    contactId: string,
    message: string,
    context: FlowContext,
  ): Promise<FlowResult> {
    // 1. Cargar el flujo completo (nodos + edges)
    // 2. Obtener o crear sesión para este contacto
    // 3. Encontrar el nodo actual (start si es nuevo)
    // 4. Ejecutar el nodo:
    //    - message: enviar mensaje al contacto
    //    - question: esperar respuesta y guardar en campo
    //    - condition: evaluar y seguir edge Sí/No
    //    - ai_extract: usar LLM para extraer datos del mensaje
    //    - crm_action: ejecutar acción en CRM (PATCH flota-prospecto, etc.)
    //    - human_handoff: transferir a agente humano en Chatwoot
    //    - end: finalizar flujo
    // 5. Guardar estado de la sesión
    // 6. Si hay respuesta, enviar via Chatwoot API
    // 7. Devolver resultado
  }
}

type FlowContext = {
  contactId: string;
  contactPhone: string;
  contactName: string;
  sessionData: Record<string, any>; // Datos recolectados durante el flujo
  chatwootConversationId: number;
};
```

### 3.4 Sesiones de flujo

```prisma
model BotFlowSession {
  id          String   @id @default(cuid())
  flowId      String
  contactId   String   // ID del FlotaProspecto
  currentNodeId String? // Nodo actual del flujo
  data        Json     @default("{}") // Datos recolectados
  status      String   @default("active") // active | completed | handed_off | expired
  startedAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  completedAt DateTime?
}
```

---

## Fase 4: Frontend — Agentes IA reales

### 4.1 Conectar el módulo Agentes IA al backend

El módulo actual (`frontend/src/modules/comercial/agentes-ia/`) es mayormente mock.

| Tab | Estado actual | Acción |
|-----|--------------|--------|
| **Agentes** | Mock (3 agentes hardcodeados) | Conectar a `GET/POST /api/ai/agents` |
| **Instrucciones copiloto** | ✅ Real (usa API) | Mantener |
| **Conocimiento** | ✅ Real (usa API) | Mantener |
| **Router Rules** | Mock (datos locales) | Conectar a `GET/POST /api/ai/routes` |
| **Contactos** | Mock | Mostrar contactos de Chatwoot + FlotaProspecto vinculados |
| **Supervisión** | Mock | Mostrar conversaciones con baja confianza o escaladas |
| **Entrenamiento** | Mock | Vincular a datasets reales (QA pairs) |
| **Logs** | Mock | Mostrar logs reales de ejecución de agentes |
| **Re-engagement** | Mock | Campañas programadas |
| **Stats** | Mock | KPIs reales (conversaciones, tokens, latencia) |
| **Config** | Mock | Persistir en backend |

### 4.2 Agregar sección Agentes IA en Flota

El módulo actual está en `comercial/agentes-ia`. Podría tener sentido moverlo o referenciarlo desde Flota también, ya que los agentes responderán en el inbox de Flota.

Opción: agregar una pestaña **"Agentes"** en `FlotaMensajes` dentro de la sección de automatización, o como acceso directo desde la barra lateral.

---

## Fase 5: Frontend — Bot Flow Builder real

### 5.1 Conectar el Bot Flow Builder al backend

El builder (`frontend/src/modules/flota/bot-flow/`) es solo frontend. Cambios:

| Archivo | Cambio |
|---------|--------|
| `bot-flow/types.ts` | Los tipos ya están definidos → conectar a API |
| `BotListView.tsx` | Listar flujos desde `GET /api/bot-flows` |
| `BotFlowBuilder.tsx` | Guardar/cargar flujos desde API |
| `NodeConfigPanel.tsx` | Persistir config de nodos |
| `FlowValidator.tsx` | ✅ Ya funciona localmente |
| `BotTestSimulator.tsx` | ✅ Ya funciona localmente |
| `BotLogsView.tsx` | Mostrar logs desde `GET /api/bot-flows/:id/logs` |
| `BotStatsView.tsx` | Mostrar stats desde `GET /api/bot-flows/:id/stats` |

### 5.2 Guardado en tiempo real

Cuando el usuario mueve nodos o edita config en el canvas:
- Debounce de 2s
- Batch PUT de todos los nodos/edges
- No perder cambios si cierra el navegador

### 5.3 Estados de nodos en tiempo real

En la vista del flow, mostrar:
- Nodo activo actualmente (para una conversación específica)
- Historial de qué nodos se ejecutaron
- Tiempo de ejecución por nodo

---

## Fase 6: Integración Chatwoot → AI Engine

### 6.1 Flujo completo

```
1. Mensaje entra a Chatwoot (WhatsApp)
2. Chatwoot envía webhook POST → /api/chatwoot/webhook
3. Nuestro webhook recibe el evento "message_created"
4. Buscar FlotaProspecto por número de teléfono
5. Obtener o crear AiConversation para este contacto
6. Router decide: agente específico o flujo visual

   [AGENTE IA]
   7a. Cargar instrucciones + KBs del agente
   8a. Llamar a OpenAI con tools configuradas
   9a. Generar respuesta + acciones

   [BOT FLOW]
   7b. Cargar flujo y sesión activa del contacto
   8b. Ejecutar nodo actual
   9b. Si es message → generar texto; si es question → esperar input

10. Enviar respuesta via POST Chatwoot API
11. Contacto recibe mensaje en WhatsApp
```

### 6.2 Human Handoff

Cuando el agente o flujo determine que necesita intervención humana:

```
1. Bot ejecuta nodo human_handoff (o IA detecta que no puede resolver)
2. Backend marca conversación para revisión
3. Chatwoot asigna la conversación a un agente humano
4. En el CRM, aparece en la sección Supervisión
5. Humano responde desde Chatwoot o desde el CRM
```

### 6.3 Rate limiting y costos

- Límite de requests por minuto por conversación
- Presupuesto de tokens por día
- Fallback a respuestas predefinidas si se excede el límite
- Logging de costos por agente y por conversación

---

## Resumen de fases

| Fase | Descripción | Esfuerzo |
|------|-------------|----------|
| **0** | Chatwoot integration (plan separado) | ~8 días |
| **1** | Modelo AiAgent + CRUD + Router | 3 días |
| **2** | Refactor AiService multi-agente | 3 días |
| **3** | Bot Flow Engine + modelos + endpoints | 4 días |
| **4** | Frontend Agentes IA real | 3 días |
| **5** | Frontend Bot Flow real | 3 días |
| **6** | Integración Chatwoot → AI Engine | 3 días |
| **Total** | | **~19 días** |

## Dependencias

```
Chatwoot Integration (Fase 0)
    ↓
Modelo Agentes (Fase 1) ← → Refactor AiService (Fase 2)
    ↓                                ↓
Integración Chatwoot → AI (Fase 6)  Bot Flow Engine (Fase 3)
    ↓                                ↓
Frontend Agentes IA (Fase 4)        Frontend Bot Flow (Fase 5)
```

Se puede empezar con las Fases 1 y 2 en paralelo una vez que Chatwoot esté funcionando.

## Consideraciones de infraestructura

- **OpenAI API Key** necesaria para los agentes (ya existe)
- **Embeddings:** pgvector ya configurado (1536 dimensiones)
- **Rate limiting:** control por agente y por usuario
- **Monitoreo:** logs de ejecución, costos, latencia
- **Fallback:** si OpenAI falla, responder con mensaje genérico o escalar a humano

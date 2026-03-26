/** Datos genéricos de demostración (sin nombres reales). */

export type AgentStatus = 'activo' | 'inactivo' | 'borrador';

export type MockAgent = {
  id: string;
  name: string;
  internalName: string;
  description: string;
  purpose: string;
  status: AgentStatus;
  model: string;
  version: string;
  tags: string[];
};

export type KnowledgeType = 'documentos' | 'web' | 'faq' | 'tabular';

export type MockKnowledge = {
  id: string;
  title: string;
  description: string;
  type: KnowledgeType;
  chunks: number;
  agentName: string;
  updatedAt: string;
  status: 'indexado' | 'sync' | 'error' | 'pendiente';
};

export type MockRouterRule = {
  id: string;
  title: string;
  conditions: string;
  priority: number;
  agentName: string;
  status: 'activo' | 'inactivo';
};

export type MockAiContact = {
  id: string;
  externalRef: string;
  channel: string;
  agentName: string;
  lastInteraction: string;
  status: 'activo' | 'en_espera' | 'cerrado';
};

export type MockSupervisionItem = {
  id: string;
  kind: 'revision' | 'baja_confianza' | 'escalacion';
  summary: string;
  agentName: string;
  confidence: number;
  submittedAt: string;
};

export type MockDataset = {
  id: string;
  name: string;
  examples: number;
  status: 'listo' | 'procesando' | 'requiere_revision';
  updatedAt: string;
};

export type MockLog = {
  id: string;
  at: string;
  conversationId: string;
  agentName: string;
  decision: string;
  confidence: number;
  tokens: number;
  latencyMs: number;
  type: 'inferencia' | 'router' | 'tool' | 'error';
  mode: 'prod' | 'simulacion';
  detail: string;
};

export type MockReengageRule = {
  id: string;
  name: string;
  trigger: string;
  channel: string;
  status: 'activo' | 'pausa';
};

const ISO = (d: string) => `${d}T12:00:00.000Z`;

export const initialAgents: MockAgent[] = [
  {
    id: 'ag-1',
    name: 'Agente comercial — descubrimiento',
    internalName: 'sales_discovery_v3',
    description:
      'Califica intención, recopila necesidades y deriva al especialista adecuado.',
    purpose: 'Primer contacto y enrutamiento de oportunidades.',
    status: 'activo',
    model: 'gpt-4o-mini',
    version: '3.2.1',
    tags: ['ventas', 'router', 'pipeline'],
  },
  {
    id: 'ag-2',
    name: 'Agente soporte — nivel 1',
    internalName: 'support_l1_stable',
    description:
      'Resuelve incidencias frecuentes con base de conocimiento verificada.',
    purpose: 'Reducir tiempo de primera respuesta y desvíos humanos.',
    status: 'activo',
    model: 'claude-3-5-sonnet',
    version: '1.8.0',
    tags: ['soporte', 'kb', 'sla'],
  },
  {
    id: 'ag-3',
    name: 'Agente copiloto — borrador',
    internalName: 'copilot_draft_lab',
    description:
      'Genera borradores de correo y resúmenes; no envía sin confirmación.',
    purpose: 'Asistencia redacción interna.',
    status: 'borrador',
    model: 'gpt-4o',
    version: '0.9.4',
    tags: ['copilot', 'email', 'interno'],
  },
];

export const initialKnowledge: MockKnowledge[] = [
  {
    id: 'kb-1',
    title: 'Catálogo de servicios — revisión Q3',
    description: 'PDF estructurado con políticas comerciales vigentes.',
    type: 'documentos',
    chunks: 842,
    agentName: 'Agente comercial — descubrimiento',
    updatedAt: ISO('2026-03-18'),
    status: 'indexado',
  },
  {
    id: 'kb-2',
    title: 'FAQs soporte — consolidado',
    description: 'Artículos homologados desde el help center.',
    type: 'faq',
    chunks: 315,
    agentName: 'Agente soporte — nivel 1',
    updatedAt: ISO('2026-03-12'),
    status: 'indexado',
  },
  {
    id: 'kb-3',
    title: 'Scraping documentación pública',
    description: 'Fuentes externas con re-crawl semanal.',
    type: 'web',
    chunks: 2104,
    agentName: 'Agente comercial — descubrimiento',
    updatedAt: ISO('2026-03-21'),
    status: 'sync',
  },
];

export const initialRouterRules: MockRouterRule[] = [
  {
    id: 'rr-1',
    title: 'Alta intención + empresa conocida',
    conditions: 'score ≥ 0.82 AND segment = enterprise',
    priority: 10,
    agentName: 'Agente comercial — descubrimiento',
    status: 'activo',
  },
  {
    id: 'rr-2',
    title: 'Palabras clave soporte',
    conditions: 'keywords IN {factura, error, reembolso}',
    priority: 40,
    agentName: 'Agente soporte — nivel 1',
    status: 'activo',
  },
  {
    id: 'rr-3',
    title: 'Tráfico de laboratorio',
    conditions: 'header.x-env = staging',
    priority: 90,
    agentName: 'Agente copiloto — borrador',
    status: 'inactivo',
  },
];

export const initialAiContacts: MockAiContact[] = [
  {
    id: 'c-ai-1',
    externalRef: 'THR-8291',
    channel: 'WhatsApp',
    agentName: 'Agente comercial — descubrimiento',
    lastInteraction: ISO('2026-03-25'),
    status: 'activo',
  },
  {
    id: 'c-ai-2',
    externalRef: 'EML-4410',
    channel: 'Correo',
    agentName: 'Agente soporte — nivel 1',
    lastInteraction: ISO('2026-03-24'),
    status: 'en_espera',
  },
  {
    id: 'c-ai-3',
    externalRef: 'WS-9912',
    channel: 'Web chat',
    agentName: 'Agente copiloto — borrador',
    lastInteraction: ISO('2026-03-22'),
    status: 'cerrado',
  },
];

export const initialSupervision: MockSupervisionItem[] = [
  {
    id: 'sv-1',
    kind: 'revision',
    summary: 'Respuesta con política desactualizada detectada por validador.',
    agentName: 'Agente comercial — descubrimiento',
    confidence: 0.71,
    submittedAt: ISO('2026-03-25'),
  },
  {
    id: 'sv-2',
    kind: 'baja_confianza',
    summary: 'Confianza 0.54 en clasificación de ticket.',
    agentName: 'Agente soporte — nivel 1',
    confidence: 0.54,
    submittedAt: ISO('2026-03-24'),
  },
  {
    id: 'sv-3',
    kind: 'escalacion',
    summary: 'Usuario solicitó supervisor; SLA crítico.',
    agentName: 'Agente soporte — nivel 1',
    confidence: 0.39,
    submittedAt: ISO('2026-03-23'),
  },
];

export const initialDatasets: MockDataset[] = [
  {
    id: 'ds-1',
    name: 'Eval router — producción',
    examples: 1280,
    status: 'listo',
    updatedAt: ISO('2026-03-10'),
  },
  {
    id: 'ds-2',
    name: 'Few-shot tono formal',
    examples: 86,
    status: 'procesando',
    updatedAt: ISO('2026-03-24'),
  },
  {
    id: 'ds-3',
    name: 'Gold set incidencias L1',
    examples: 420,
    status: 'requiere_revision',
    updatedAt: ISO('2026-03-18'),
  },
];

export const initialLogs: MockLog[] = [
  {
    id: 'lg-1',
    at: ISO('2026-03-25'),
    conversationId: 'CONV-100882',
    agentName: 'Agente comercial — descubrimiento',
    decision: 'Deriva a especialista sector salud',
    confidence: 0.88,
    tokens: 2140,
    latencyMs: 840,
    type: 'inferencia',
    mode: 'prod',
    detail:
      'Contexto: usuario consultó volumen anual. Router seleccionó flujo B2B; memoria de corto plazo limitada a 6 turnos.',
  },
  {
    id: 'lg-2',
    at: ISO('2026-03-25'),
    conversationId: 'CONV-100881',
    agentName: 'Agente soporte — nivel 1',
    decision: 'Invocó herramienta KB — artículo 42',
    confidence: 0.92,
    tokens: 980,
    latencyMs: 412,
    type: 'tool',
    mode: 'prod',
    detail:
      'Tool: knowledge_search; filtros: tag=soporte, versión=2026-Q1. Retornó fragmento con score 0.91.',
  },
  {
    id: 'lg-3',
    at: ISO('2026-03-24'),
    conversationId: 'CONV-100770',
    agentName: 'Agente comercial — descubrimiento',
    decision: 'Regla prioridad 10 activada',
    confidence: 0.79,
    tokens: 120,
    latencyMs: 56,
    type: 'router',
    mode: 'simulacion',
    detail:
      'Simulación de laboratorio; condición enterprise + score alto. Sin persistencia en CRM.',
  },
];

export const initialReengage: MockReengageRule[] = [
  {
    id: 're-1',
    name: 'Seguimiento 24h sin respuesta',
    trigger: 'silencio > 24h tras mensaje saliente',
    channel: 'WhatsApp',
    status: 'activo',
  },
  {
    id: 're-2',
    name: 'Cierre suave — encuesta',
    trigger: 'conversación resuelta + CSAT pendiente',
    channel: 'Correo',
    status: 'activo',
  },
  {
    id: 're-3',
    name: 'Reactivación inactivos',
    trigger: 'última interacción > 30 días',
    channel: 'Web chat',
    status: 'pausa',
  },
];

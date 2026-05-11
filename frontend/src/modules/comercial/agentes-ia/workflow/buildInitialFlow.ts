import type { Edge } from '@xyflow/react';
import type { FlowNodeType } from './flowTypes';
import type { ToolChoice } from '../flows/AddToolDialog';

export function buildInitialFlow(agentLabel: string): {
  nodes: FlowNodeType[];
  edges: Edge[];
} {
  const nodes: FlowNodeType[] = [
    {
      id: 'n-llm',
      type: 'orchestrationNode',
      position: { x: 40, y: 120 },
      data: {
        kind: 'llm',
        title: 'GPT-4o Mini',
        subtitle: 'Razonamiento principal',
        status: 'ok',
        llm: {
          model: 'gpt-4o-mini',
          temperature: 0.35,
          maxTokens: 2048,
          confidenceFloor: 0.72,
          maxTurns: 14,
          waitBeforeRespondMs: 180,
          transferToHuman: 'low_conf',
          modelTier: 'recommended',
        },
      },
    },
    {
      id: 'n-memory',
      type: 'orchestrationNode',
      position: { x: 40, y: 340 },
      data: {
        kind: 'memory',
        title: 'Memoria contextual',
        subtitle: 'Perfil + políticas',
        status: 'ok',
        memory: {
          profileContactMemory: true,
          reengagementAuto: true,
          contextualAi: true,
          tonePolicy: 'consultivo',
          followUpPresets: ['24h', '72h', 'campo libre'],
          contextWindow: '12 turnos · resumen cada 6',
          toneNotes: 'Formal, segunda persona, sin promesas legales',
        },
      },
    },
    {
      id: 'n-agent',
      type: 'orchestrationNode',
      position: { x: 380, y: 200 },
      data: {
        kind: 'agent',
        title: 'Orquestador',
        subtitle: agentLabel,
        status: 'ok',
        agentMeta: {
          tag: 'ventas_b2b',
          shortDescription:
            'Enruta intenciones, invoca herramientas y aplica políticas de handoff.',
          active: true,
        },
      },
    },
    {
      id: 'n-kb',
      type: 'orchestrationNode',
      position: { x: 720, y: 20 },
      data: {
        kind: 'knowledge',
        title: 'KB comercial',
        subtitle: 'Catálogo homologado',
        status: 'ok',
        knowledge: {
          internalId: 'kb_int_01',
          displayName: 'Políticas Q1 · Lima',
          description: 'Fragmentos aprobados compliance',
          kbId: 'kb-prod-01',
          linkedBaseIds: ['kb-prod-01', 'kb-faq-support'],
          topK: 6,
          indexStatus: 'indexado',
        },
      },
    },
    {
      id: 'n-db',
      type: 'orchestrationNode',
      position: { x: 720, y: 200 },
      data: {
        kind: 'database',
        title: 'Réplica analytics',
        subtitle: 'Solo lectura',
        status: 'ok',
        database: {
          internalId: 'db_analytics_ro',
          displayName: 'CRM summaries (RO)',
          description: 'Consultas de verificación de registro',
          host: 'db.internal.local',
          port: '5432',
          db: 'crm_analytics',
          user: 'svc_crm_read',
          passwordMasked: '••••••••',
          table: 'crm_interaction_summary',
          columnsPreview: 'ref, topic, confidence, updated_at',
          query:
            'SELECT topic, confidence FROM crm_interaction_summary WHERE ref = :ref',
          connectionLabel: 'postgres_replica_pe',
        },
      },
    },
    {
      id: 'n-api',
      type: 'orchestrationNode',
      position: { x: 720, y: 400 },
      data: {
        kind: 'api',
        title: 'Gateway tickets',
        subtitle: 'Integración interna',
        status: 'warn',
        api: {
          internalId: 'api_tickets_v2',
          displayName: 'Creación de ticket',
          description: 'Abre ticket priorizado en mesa de ayuda',
          method: 'POST',
          authType: 'bearer',
          authSecretMasked: 'vault/tickets/prod',
          endpoint: 'https://gateway.internal/tools/ticket',
          bodyTemplate:
            '{\n  "priority": "{{p}}",\n  "summary": "{{s}}"\n}',
          variableMap: ['{{p}} prioridad', '{{s}} resumen'],
        },
      },
    },
    {
      id: 'n-static',
      type: 'orchestrationNode',
      position: { x: 380, y: 420 },
      data: {
        kind: 'static',
        title: 'Handoff estático',
        subtitle: 'Cola y SLA',
        status: 'ok',
        staticData: {
          internalId: 'static_handoff_01',
          displayName: 'Mapa colas',
          kv: 'queue.priority=high',
          json: '{\n  "team": "tier2",\n  "sla_minutes": 45\n}',
        },
      },
    },
  ];

  const edges: Edge[] = [
    {
      id: 'e-llm-agent',
      type: 'workflowEdge',
      source: 'n-llm',
      target: 'n-agent',
      label: 'Modelo',
      data: { accent: 'var(--chart-4)' },
    },
    {
      id: 'e-mem-agent',
      type: 'workflowEdge',
      source: 'n-memory',
      target: 'n-agent',
      label: 'Contexto',
      data: { accent: 'var(--chart-1)' },
    },
    {
      id: 'e-agent-kb',
      type: 'workflowEdge',
      source: 'n-agent',
      target: 'n-kb',
      label: 'info_delivery_lima',
      data: { accent: 'var(--chart-3)' },
    },
    {
      id: 'e-agent-db',
      type: 'workflowEdge',
      source: 'n-agent',
      target: 'n-db',
      label: 'base_de_datos',
      data: { accent: 'var(--chart-5)' },
    },
    {
      id: 'e-agent-api',
      type: 'workflowEdge',
      source: 'n-agent',
      target: 'n-api',
      label: 'verificar_registro',
      data: { accent: 'var(--chart-2)' },
    },
    {
      id: 'e-agent-static',
      type: 'workflowEdge',
      source: 'n-agent',
      target: 'n-static',
      label: 'policy_static',
      data: { accent: 'var(--chart-1)' },
    },
  ];

  return { nodes, edges };
}

export function emptyToolNode(
  id: string,
  kind: ToolChoice,
  position: { x: number; y: number },
): FlowNodeType {
  switch (kind) {
    case 'knowledge':
      return {
        id,
        type: 'orchestrationNode',
        position,
        data: {
          kind: 'knowledge',
          title: 'Nueva KB',
          subtitle: 'Configurar fuente',
          status: 'warn',
          knowledge: {
            internalId: `kb_new_${id.slice(-6)}`,
            displayName: 'Fuente sin nombre',
            description: '—',
            kbId: 'kb-borrador',
            linkedBaseIds: [],
            topK: 4,
            indexStatus: 'sync',
          },
        },
      };
   
    case 'database':
      return {
        id,
        type: 'orchestrationNode',
        position,
        data: {
          kind: 'database',
          title: 'Nueva DB',
          subtitle: 'Conexión',
          status: 'warn',
          database: {
            internalId: `db_new_${id.slice(-6)}`,
            displayName: 'Integración DB',
            description: '—',
            host: '',
            port: '5432',
            db: '',
            user: '',
            passwordMasked: '',
            table: '',
            columnsPreview: '—',
            query: 'SELECT 1',
            connectionLabel: 'sin_probar',
          },
        },
      };
    case 'api':
      return {
        id,
        type: 'orchestrationNode',
        position,
        data: {
          kind: 'api',
          title: 'Nueva API',
          subtitle: 'Endpoint',
          status: 'warn',
          api: {
            internalId: `api_new_${id.slice(-6)}`,
            displayName: 'Herramienta HTTP',
            description: '—',
            method: 'POST',
            authType: 'none',
            authSecretMasked: '',
            endpoint: 'https://',
            bodyTemplate: '{}',
            variableMap: [],
          },
        },
      };
    case 'static':
      return {
        id,
        type: 'orchestrationNode',
        position,
        data: {
          kind: 'static',
          title: 'Datos estáticos',
          subtitle: 'KV / JSON',
          status: 'warn',
          staticData: {
            internalId: `st_new_${id.slice(-6)}`,
            displayName: 'Bloque estático',
            kv: '',
            json: '{\n  \n}',
          },
        },
      };
  }
}

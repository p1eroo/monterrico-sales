import type { Node, Edge } from '@xyflow/react';

export type BotNodeType =
  | 'start'
  | 'message'
  | 'question'
  | 'condition'
  | 'ai_extract'
  | 'crm_action'
  | 'human_handoff'
  | 'end';

export const BOT_NODE_TYPES: BotNodeType[] = [
  'start',
  'message',
  'question',
  'condition',
  'ai_extract',
  'crm_action',
  'human_handoff',
  'end',
];

export const NODE_LABELS: Record<BotNodeType, string> = {
  start: 'Inicio',
  message: 'Mensaje',
  question: 'Pregunta',
  condition: 'Condición',
  ai_extract: 'Extraer IA',
  crm_action: 'Acción CRM',
  human_handoff: 'Derivar a humano',
  end: 'Fin',
};

export const NODE_DESCRIPTIONS: Record<BotNodeType, string> = {
  start: 'Punto de entrada del flujo',
  message: 'Envía un mensaje al contacto',
  question: 'Pregunta y guarda respuesta',
  condition: 'Rama condicional',
  ai_extract: 'Extrae datos con IA',
  crm_action: 'Ejecuta acción en CRM',
  human_handoff: 'Deriva a un operador',
  end: 'Finaliza el flujo',
};

export const NODE_COLORS: Record<BotNodeType, string> = {
  start: '#10b981',
  message: '#3b82f6',
  question: '#f59e0b',
  condition: '#8b5cf6',
  ai_extract: '#06b6d4',
  crm_action: '#f43f5e',
  human_handoff: '#ec4899',
  end: '#64748b',
};

export const NODE_ICON_NAMES: Record<BotNodeType, string> = {
  start: 'Play',
  message: 'MessageCircle',
  question: 'HelpCircle',
  condition: 'GitFork',
  ai_extract: 'Brain',
  crm_action: 'UserCheck',
  human_handoff: 'UserPlus',
  end: 'StopCircle',
};

export const FIELD_TYPES = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'date', label: 'Fecha' },
  { value: 'plate', label: 'Placa' },
  { value: 'phone', label: 'Teléfono' },
  { value: 'email', label: 'Email' },
] as const;

export const CONDITION_OPERATORS = [
  { value: 'equals', label: 'Igual a' },
  { value: 'contains', label: 'Contiene' },
  { value: 'exists', label: 'Existe' },
  { value: 'greater_than', label: 'Mayor que' },
  { value: 'less_than', label: 'Menor que' },
  { value: 'intent_is', label: 'Intención es' },
] as const;

export const CRM_ACTION_TYPES = [
  { value: 'add_tag', label: 'Agregar etiqueta' },
  { value: 'remove_tag', label: 'Quitar etiqueta' },
  { value: 'assign_operator', label: 'Asignar operador' },
  { value: 'update_contact', label: 'Actualizar contacto' },
  { value: 'update_conversation_status', label: 'Cambiar estado' },
  { value: 'create_task', label: 'Crear tarea' },
] as const;

export interface StartNodeConfig {
  name: string;
  description: string;
}

export interface MessageNodeConfig {
  text: string;
  attachments: string[];
  delay: number;
}

export interface QuestionNodeConfig {
  text: string;
  field_key: string;
  field_type: string;
  use_ai_extraction: boolean;
  extraction_schema: string;
  fallback_message: string;
  max_attempts: number;
}

export interface ConditionRule {
  id: string;
  operator: string;
  field_key: string;
  value: string;
  output_label: string;
}

export interface ConditionNodeConfig {
  rules: ConditionRule[];
}

export interface AiExtractNodeConfig {
  prompt: string;
  schema: string;
  min_confidence: number;
  fallback_message: string;
}

export interface CrmActionNodeConfig {
  action_type: string;
  payload: string;
}

export interface HumanHandoffNodeConfig {
  message: string;
  queue: string;
  operator: string;
  tag: string;
}

export interface EndNodeConfig {
  message: string;
  session_status: string;
}

export type BotNodeConfig =
  | StartNodeConfig
  | MessageNodeConfig
  | QuestionNodeConfig
  | ConditionNodeConfig
  | AiExtractNodeConfig
  | CrmActionNodeConfig
  | HumanHandoffNodeConfig
  | EndNodeConfig;

export interface BotNodeConfigMap {
  start: StartNodeConfig;
  message: MessageNodeConfig;
  question: QuestionNodeConfig;
  condition: ConditionNodeConfig;
  ai_extract: AiExtractNodeConfig;
  crm_action: CrmActionNodeConfig;
  human_handoff: HumanHandoffNodeConfig;
  end: EndNodeConfig;
}

export function getDefaultConfig(type: BotNodeType): BotNodeConfig {
  switch (type) {
    case 'start':
      return { name: 'Nuevo flujo', description: '' } as StartNodeConfig;
    case 'message':
      return { text: '', attachments: [], delay: 0 } as MessageNodeConfig;
    case 'question':
      return {
        text: '',
        field_key: '',
        field_type: 'text',
        use_ai_extraction: false,
        extraction_schema: '{}',
        fallback_message: 'No entendí tu respuesta.',
        max_attempts: 3,
      } as QuestionNodeConfig;
    case 'condition':
      return { rules: [] } as ConditionNodeConfig;
    case 'ai_extract':
      return {
        prompt: '',
        schema: '{}',
        min_confidence: 0.7,
        fallback_message: 'No pude extraer la información.',
      } as AiExtractNodeConfig;
    case 'crm_action':
      return { action_type: 'add_tag', payload: '{}' } as CrmActionNodeConfig;
    case 'human_handoff':
      return { message: 'Te transfiero con un agente.', queue: '', operator: '', tag: '' } as HumanHandoffNodeConfig;
    case 'end':
      return { message: '', session_status: 'completed' } as EndNodeConfig;
  }
}

export interface BotFlowNodeData {
  nodeType: BotNodeType;
  config: BotNodeConfig;
  label: string;
  enabled: boolean;
}

export type BotFlowNodeType = Node<BotFlowNodeData, 'botNode'>;

export interface BotFlowEdgeData {
  condition_type: 'always' | 'conditional';
  condition_config: Record<string, unknown>;
  label?: string;
}

export type BotFlowEdgeType = Edge<BotFlowEdgeData>;

export interface SerializedBotNode {
  id: string;
  type: BotNodeType;
  position_x: number;
  position_y: number;
  config: Record<string, unknown>;
  enabled: boolean;
}

export interface SerializedBotEdge {
  id: string;
  source_node_id: string;
  target_node_id: string;
  condition_type: 'always' | 'conditional';
  condition_config: Record<string, unknown>;
}

export interface BotFlowDocument {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'archived';
  nodes: SerializedBotNode[];
  edges: SerializedBotEdge[];
}

export interface ValidationError {
  nodeId?: string;
  edgeId?: string;
  message: string;
  type: 'error' | 'warning';
}

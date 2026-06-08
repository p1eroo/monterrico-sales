import type { BotNodeType, BotNodeConfig, StartNodeConfig, MessageNodeConfig, QuestionNodeConfig, ConditionNodeConfig, ConditionRule, AiExtractNodeConfig, CrmActionNodeConfig, HumanHandoffNodeConfig, EndNodeConfig, BotFlowNodeData } from './types';

export interface MockNodeDef {
  id: string;
  type: BotNodeType;
  position: { x: number; y: number };
  data: BotFlowNodeData;
}

export interface MockEdgeDef {
  id: string;
  source: string;
  target: string;
  condition_type?: 'always' | 'conditional';
  condition_config?: Record<string, unknown>;
  label?: string;
}

export function createMockFlow(): { nodes: MockNodeDef[]; edges: MockEdgeDef[] } {
  const nodes: MockNodeDef[] = [
    {
      id: 'n-1',
      type: 'start',
      position: { x: 50, y: 200 },
      data: {
        nodeType: 'start',
        label: 'Inicio',
        enabled: true,
        config: { name: 'Flujo de bienvenida', description: 'Flujo principal para nuevos contactos' } as StartNodeConfig,
      },
    },
    {
      id: 'n-2',
      type: 'message',
      position: { x: 350, y: 200 },
      data: {
        nodeType: 'message',
        label: 'Mensaje de bienvenida',
        enabled: true,
        config: {
          text: '¡Hola! Soy el asistente de Taxi Monterrico. ¿En qué puedo ayudarte hoy?',
          attachments: [],
          delay: 0,
        } as MessageNodeConfig,
      },
    },
    {
      id: 'n-3',
      type: 'question',
      position: { x: 650, y: 200 },
      data: {
        nodeType: 'question',
        label: 'Preguntar nombre',
        enabled: true,
        config: {
          text: '¿Podrías decirme tu nombre completo?',
          field_key: 'nombreCompleto',
          field_type: 'text',
          use_ai_extraction: false,
          extraction_schema: '{}',
          fallback_message: 'Por favor, escribí tu nombre.',
          max_attempts: 3,
        } as QuestionNodeConfig,
      },
    },
    {
      id: 'n-4',
      type: 'question',
      position: { x: 650, y: 400 },
      data: {
        nodeType: 'question',
        label: 'Consultar vehículo',
        enabled: true,
        config: {
          text: '¿Tenés vehículo propio?',
          field_key: 'tieneVehiculo',
          field_type: 'boolean',
          use_ai_extraction: false,
          extraction_schema: '{}',
          fallback_message: 'Respondé sí o no.',
          max_attempts: 2,
        } as QuestionNodeConfig,
      },
    },
    {
      id: 'n-5',
      type: 'condition',
      position: { x: 950, y: 300 },
      data: {
        nodeType: 'condition',
        label: '¿Tiene vehículo?',
        enabled: true,
        config: {
          rules: [
            { id: 'r1', operator: 'equals', field_key: 'tieneVehiculo', value: 'true', output_label: 'Sí' },
            { id: 'r2', operator: 'equals', field_key: 'tieneVehiculo', value: 'false', output_label: 'No' },
          ],
        } as ConditionNodeConfig,
      },
    },
    {
      id: 'n-6',
      type: 'ai_extract',
      position: { x: 1250, y: 200 },
      data: {
        nodeType: 'ai_extract',
        label: 'Extraer datos vehículo',
        enabled: true,
        config: {
          prompt: 'Extraé la marca, modelo, año y placa del vehículo del conductor.',
          schema: '{"type":"object","properties":{"marca":{"type":"string"},"modelo":{"type":"string"},"anio":{"type":"number"},"placa":{"type":"string"}}}',
          min_confidence: 0.7,
          fallback_message: 'No pude identificar los datos de tu vehículo.',
        } as AiExtractNodeConfig,
      },
    },
    {
      id: 'n-7',
      type: 'question',
      position: { x: 1250, y: 400 },
      data: {
        nodeType: 'question',
        label: 'Preguntar interés',
        enabled: true,
        config: {
          text: '¿Te gustaría recibir más información sobre nuestros planes?',
          field_key: 'interes',
          field_type: 'boolean',
          use_ai_extraction: false,
          extraction_schema: '{}',
          fallback_message: 'Respondé sí o no por favor.',
          max_attempts: 2,
        } as QuestionNodeConfig,
      },
    },
    {
      id: 'n-8',
      type: 'crm_action',
      position: { x: 1550, y: 200 },
      data: {
        nodeType: 'crm_action',
        label: 'Actualizar contacto',
        enabled: true,
        config: {
          action_type: 'update_contact',
          payload: '{"etapa":"Afiliado"}',
        } as CrmActionNodeConfig,
      },
    },
    {
      id: 'n-9',
      type: 'human_handoff',
      position: { x: 1550, y: 400 },
      data: {
        nodeType: 'human_handoff',
        label: 'Derivar a operador',
        enabled: true,
        config: {
          message: 'Uno de nuestros asesores se comunicará con vos a la brevedad.',
          queue: 'ventas',
          operator: '',
          tag: 'interesado',
        } as HumanHandoffNodeConfig,
      },
    },
    {
      id: 'n-10',
      type: 'end',
      position: { x: 1850, y: 300 },
      data: {
        nodeType: 'end',
        label: 'Fin del flujo',
        enabled: true,
        config: { message: 'Gracias por comunicarte con Taxi Monterrico.', session_status: 'completed' } as EndNodeConfig,
      },
    },
  ];

  const edges: MockEdgeDef[] = [
    { id: 'e-1', source: 'n-1', target: 'n-2' },
    { id: 'e-2', source: 'n-2', target: 'n-3' },
    { id: 'e-3', source: 'n-3', target: 'n-4' },
    { id: 'e-4', source: 'n-4', target: 'n-5' },
    { id: 'e-5', source: 'n-5', target: 'n-6', condition_type: 'conditional', condition_config: { rule_id: 'r1' }, label: 'Sí' },
    { id: 'e-6', source: 'n-5', target: 'n-7', condition_type: 'conditional', condition_config: { rule_id: 'r2' }, label: 'No' },
    { id: 'e-7', source: 'n-6', target: 'n-8' },
    { id: 'e-8', source: 'n-7', target: 'n-9' },
    { id: 'e-9', source: 'n-8', target: 'n-10' },
    { id: 'e-10', source: 'n-9', target: 'n-10' },
  ];

  return { nodes, edges };
}

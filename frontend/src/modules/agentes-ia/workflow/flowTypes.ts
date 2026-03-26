import type { Node } from '@xyflow/react';

export type FlowNodeKind =
  | 'llm'
  | 'memory'
  | 'agent'
  | 'knowledge'
  | 'database'
  | 'api'
  | 'static';

export type NodeStatus = 'ok' | 'warn' | 'off';

export type TransferToHumanPolicy = 'never' | 'low_conf' | 'always_offer';

export type TonePolicy = 'consultivo' | 'comercial' | 'neutro';

export type ApiAuthType = 'none' | 'bearer' | 'apikey' | 'basic';

export type FlowNodeData = {
  kind: FlowNodeKind;
  title: string;
  subtitle: string;
  status: NodeStatus;
  agentMeta?: {
    tag: string;
    shortDescription: string;
    active: boolean;
  };
  llm?: {
    model: string;
    temperature: number;
    maxTokens: number;
    confidenceFloor: number;
    maxTurns: number;
    waitBeforeRespondMs: number;
    transferToHuman: TransferToHumanPolicy;
    /** UI: marca sugerida en tarjetas de modelo */
    modelTier: 'standard' | 'recommended' | 'premium';
  };
  memory?: {
    profileContactMemory: boolean;
    reengagementAuto: boolean;
    contextualAi: boolean;
    tonePolicy: TonePolicy;
    /** chips de preset de seguimiento */
    followUpPresets: string[];
    /** texto libre ventana / resumen */
    contextWindow: string;
    toneNotes: string;
  };
  knowledge?: {
    internalId: string;
    displayName: string;
    description: string;
    kbId: string;
    linkedBaseIds: string[];
    topK: number;
    indexStatus: 'indexado' | 'sync' | 'error';
  };
  database?: {
    internalId: string;
    displayName: string;
    description: string;
    host: string;
    port: string;
    db: string;
    user: string;
    passwordMasked: string;
    table: string;
    columnsPreview: string;
    query: string;
    connectionLabel: string;
  };
  api?: {
    internalId: string;
    displayName: string;
    description: string;
    method: string;
    authType: ApiAuthType;
    authSecretMasked: string;
    endpoint: string;
    bodyTemplate: string;
    variableMap: string[];
  };
  staticData?: {
    internalId: string;
    displayName: string;
    kv: string;
    json: string;
  };
};

export type FlowNodeType = Node<FlowNodeData, 'orchestrationNode'>;

export type WorkflowEdgeData = {
  accent?: string;
};

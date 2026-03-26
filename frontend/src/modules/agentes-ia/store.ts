import { create } from 'zustand';
import {
  initialAgents,
  initialAiContacts,
  initialDatasets,
  initialLogs,
  initialReengage,
  initialRouterRules,
  initialSupervision,
  type MockAgent,
  type MockAiContact,
  type MockDataset,
  type MockKnowledge,
  type MockLog,
  type MockReengageRule,
  type MockRouterRule,
  type MockSupervisionItem,
} from './mockData';

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

type AgentesIaState = {
  agents: MockAgent[];
  knowledge: MockKnowledge[];
  routerRules: MockRouterRule[];
  aiContacts: MockAiContact[];
  supervision: MockSupervisionItem[];
  datasets: MockDataset[];
  logs: MockLog[];
  reengage: MockReengageRule[];
  moduleConfig: {
    defaultModel: string;
    globalTemperature: number;
    maxTokensDefault: number;
    auditRetentionDays: number;
    simulationMode: boolean;
  };
  addAgent: (payload: Omit<MockAgent, 'id' | 'version'> & { version?: string }) => void;
  updateAgent: (id: string, patch: Partial<MockAgent>) => void;
  removeAgent: (id: string) => void;
  duplicateAgent: (id: string) => void;
  toggleAgentStatus: (id: string) => void;
  setKnowledge: (knowledge: MockKnowledge[]) => void;
  addRouterRule: (payload: Omit<MockRouterRule, 'id'>) => void;
  setModuleConfig: (
    patch: Partial<AgentesIaState['moduleConfig']>,
  ) => void;
};

export const useAgentesIaStore = create<AgentesIaState>((set, get) => ({
  agents: [...initialAgents],
  knowledge: [],
  routerRules: [...initialRouterRules],
  aiContacts: [...initialAiContacts],
  supervision: [...initialSupervision],
  datasets: [...initialDatasets],
  logs: [...initialLogs],
  reengage: [...initialReengage],
  moduleConfig: {
    defaultModel: 'gpt-4o-mini',
    globalTemperature: 0.35,
    maxTokensDefault: 2048,
    auditRetentionDays: 90,
    simulationMode: false,
  },

  addAgent: (payload) => {
    const id = `ag-${crypto.randomUUID().slice(0, 8)}`;
    const agent: MockAgent = {
      ...payload,
      id,
      version: payload.version ?? '1.0.0',
      internalName: payload.internalName || slugify(payload.name),
    };
    set((s) => ({ agents: [agent, ...s.agents] }));
  },

  updateAgent: (id, patch) =>
    set((s) => ({
      agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    })),

  removeAgent: (id) =>
    set((s) => ({ agents: s.agents.filter((a) => a.id !== id) })),

  duplicateAgent: (id) => {
    const src = get().agents.find((a) => a.id === id);
    if (!src) return;
    const copy: MockAgent = {
      ...src,
      id: `ag-${crypto.randomUUID().slice(0, 8)}`,
      name: `${src.name} (copia)`,
      internalName: `${src.internalName}_copy_${Date.now().toString(36)}`,
      status: 'borrador',
      version: '1.0.0',
    };
    set((s) => ({ agents: [copy, ...s.agents] }));
  },

  toggleAgentStatus: (id) =>
    set((s) => ({
      agents: s.agents.map((a) => {
        if (a.id !== id) return a;
        const next =
          a.status === 'activo'
            ? 'inactivo'
            : a.status === 'inactivo'
              ? 'activo'
              : 'activo';
        return { ...a, status: next };
      }),
    })),

  setKnowledge: (knowledge) => set({ knowledge }),

  addRouterRule: (payload) => {
    const row: MockRouterRule = {
      ...payload,
      id: `rr-${crypto.randomUUID().slice(0, 8)}`,
    };
    set((s) => ({ routerRules: [row, ...s.routerRules] }));
  },

  setModuleConfig: (patch) =>
    set((s) => ({
      moduleConfig: { ...s.moduleConfig, ...patch },
    })),
}));

export function getAgentById(id: string | undefined): MockAgent | undefined {
  if (!id) return undefined;
  return useAgentesIaStore.getState().agents.find((a) => a.id === id);
}

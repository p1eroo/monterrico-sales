import { create } from 'zustand';
import type { Lead, Opportunity } from '@/types';
import { leads as initialLeads, opportunities as initialOpportunities, users, etapaProbabilidad } from '@/data/mock';

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getUserName(userId: string): string {
  return users.find((u) => u.id === userId)?.name ?? 'Sin asignar';
}

interface CRMState {
  leads: Lead[];
  opportunities: Opportunity[];
  addLead: (lead: Omit<Lead, 'id' | 'assignedToName' | 'nextAction' | 'nextFollowUp' | 'createdAt' | 'etapa'> & Partial<Pick<Lead, 'notes' | 'tags' | 'etapa'>>) => Lead;
  updateLead: (id: string, updates: Partial<Lead>) => void;
  deleteLead: (id: string) => void;
  addOpportunity: (opp: Omit<Opportunity, 'id' | 'assignedToName' | 'leadName' | 'probability'> & Partial<Pick<Opportunity, 'probability'>>) => Opportunity;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  getOpportunitiesByLeadId: (leadId: string) => Opportunity[];
}

export const useCRMStore = create<CRMState>((set, get) => ({
  leads: [...initialLeads],
  opportunities: [...initialOpportunities],

  addLead: (leadData) => {
    const newLead: Lead = {
      ...leadData,
      id: generateId('l'),
      etapa: leadData.etapa ?? 'lead',
      assignedToName: getUserName(leadData.assignedTo),
      nextAction: 'Contactar',
      nextFollowUp: '',
      createdAt: new Date().toISOString().slice(0, 10),
      notes: leadData.notes,
      tags: leadData.tags,
    };
    set((state) => ({ leads: [newLead, ...state.leads] }));
    return newLead;
  },

  updateLead: (id, updates) => {
    set((state) => ({
      leads: state.leads.map((l) => (l.id === id ? { ...l, ...updates } : l)),
    }));
  },

  deleteLead: (id) => {
    set((state) => ({
      leads: state.leads.filter((l) => l.id !== id),
      opportunities: state.opportunities.filter((o) => o.leadId !== id),
    }));
  },

  addOpportunity: (oppData) => {
    const etapa = oppData.etapa ?? 'lead';
    const newOpp: Opportunity = {
      ...oppData,
      id: generateId('o'),
      etapa,
      probability: etapaProbabilidad[etapa] ?? 0,
      assignedToName: getUserName(oppData.assignedTo),
      leadName: oppData.leadId
        ? get().leads.find((l) => l.id === oppData.leadId)?.name
        : undefined,
    };
    set((state) => ({ opportunities: [newOpp, ...state.opportunities] }));
    return newOpp;
  },

  updateOpportunity: (id, updates) => {
    set((state) => {
      const opp = state.opportunities.find((o) => o.id === id);
      if (!opp) return state;

      const newStatus = updates.status ?? opp.status;
      const newEtapa = updates.etapa ?? opp.etapa;

      // Sync probability when etapa changes
      const merged = { ...updates };
      if (updates.etapa !== undefined) {
        merged.probability = etapaProbabilidad[updates.etapa];
      }

      // Sync lead when opportunity is won or lost (status or etapa)
      let newLeads = state.leads;
      if (opp.leadId) {
        const isWon = newStatus === 'ganada' || ['activo', 'cierre_ganado', 'firma_contrato'].includes(newEtapa);
        const isLost = newStatus === 'perdida' || newEtapa === 'cierre_perdido' || newEtapa === 'inactivo';
        if (isWon || isLost) {
          newLeads = state.leads.map((l) =>
            l.id === opp.leadId ? { ...l, etapa: isWon ? 'activo' : 'cierre_perdido' } : l,
          );
        }
      }

      const newOpportunities = state.opportunities.map((o) =>
        o.id === id ? { ...o, ...merged } : o,
      );

      return {
        opportunities: newOpportunities,
        leads: newLeads,
      };
    });
  },

  getOpportunitiesByLeadId: (leadId) => {
    return get().opportunities.filter((o) => o.leadId === leadId);
  },
}));

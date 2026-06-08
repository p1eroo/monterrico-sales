import { create } from 'zustand';
import type { Contact, Etapa, Opportunity, OpportunityStatus } from '@/types';
import { etapaProbabilidad } from '@/data/mock';
import { useUsersStore } from '@/store/usersStore';

/** Alineado con `OpportunitiesService.statusFromEtapa` (sin `suspendida`). Solo `activo` → ganada. */
function opportunityStatusFromEtapa(etapa: Etapa): OpportunityStatus {
  if (etapa === 'activo') return 'ganada';
  if (['cierre_perdido', 'inactivo'].includes(etapa)) return 'perdida';
  return 'abierta';
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function getUserName(userId: string): string {
  return useUsersStore.getState().getUserName(userId);
}

interface CRMState {
  contacts: Contact[];
  opportunities: Opportunity[];
  addContact: (contact: Omit<Contact, 'id' | 'assignedToName' | 'createdAt' | 'etapa'> & Partial<Pick<Contact, 'etapa'>>) => Contact;
  updateContact: (id: string, updates: Partial<Contact>) => void;
  deleteContact: (id: string) => void;
  addOpportunity: (opp: Omit<Opportunity, 'id' | 'assignedToName' | 'contactName' | 'probability'> & Partial<Pick<Opportunity, 'probability' | 'contactName'>>) => Opportunity;
  updateOpportunity: (id: string, updates: Partial<Opportunity>) => void;
  getOpportunitiesByContactId: (contactId: string) => Opportunity[];
}

export const useCRMStore = create<CRMState>((set, get) => ({
  contacts: [],
  opportunities: [],

  addContact: (contactData) => {
    const etapa = contactData.etapa ?? 'lead';
    const createdAt = new Date().toISOString().slice(0, 10);
    const newContact: Contact = {
      ...contactData,
      id: generateId('c'),
      etapa,
      assignedToName: getUserName(contactData.assignedTo),
      createdAt,
      etapaHistory: [{ etapa, fecha: createdAt }],
    };
    set((state) => ({ contacts: [newContact, ...state.contacts] }));
    return newContact;
  },

  updateContact: (id, updates) => {
    set((state) => ({
      contacts: state.contacts.map((c) => {
        if (c.id !== id) return c;
        const merged = { ...c, ...updates };
        if (updates.etapa !== undefined && updates.etapa !== c.etapa) {
          const today = new Date().toISOString().slice(0, 10);
          const history = c.etapaHistory ?? (c.createdAt ? [{ etapa: c.etapa, fecha: c.createdAt }] : []);
          merged.etapaHistory = [...history, { etapa: updates.etapa, fecha: today }];
        }
        return merged;
      }),
    }));
  },

  deleteContact: (id) => {
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      opportunities: state.opportunities.filter((o) => o.contactId !== id),
    }));
  },

  addOpportunity: (oppData) => {
    const etapa = oppData.etapa ?? 'lead';
    const resolvedContactName =
      oppData.contactName ??
      (oppData.contactId
        ? get().contacts.find((c) => c.id === oppData.contactId)?.name
        : undefined);
    const newOpp: Opportunity = {
      ...oppData,
      id: generateId('o'),
      etapa,
      status: opportunityStatusFromEtapa(etapa),
      probability: etapaProbabilidad[etapa] ?? 0,
      assignedToName: getUserName(oppData.assignedTo),
      contactName: resolvedContactName,
      fuente: oppData.fuente ?? 'base',
    };
    set((state) => ({ opportunities: [newOpp, ...state.opportunities] }));
    return newOpp;
  },

  updateOpportunity: (id, updates) => {
    set((state) => {
      const opp = state.opportunities.find((o) => o.id === id);
      if (!opp) return state;

      const merged: Partial<Opportunity> = { ...updates };
      if (updates.etapa !== undefined) {
        merged.probability = etapaProbabilidad[updates.etapa];
        merged.status = opportunityStatusFromEtapa(updates.etapa);
      } else if (updates.status !== undefined) {
        const s = updates.status;
        merged.status =
          s === 'ganada' || s === 'perdida' || s === 'abierta' ? s : 'abierta';
      }

      const newEtapa = updates.etapa ?? opp.etapa;
      const newStatus = (merged.status !== undefined ? merged.status : opp.status) as OpportunityStatus;

      let newContacts = state.contacts;
      if (opp.contactId) {
        const isWon = newEtapa === 'activo';
        const isLost = newStatus === 'perdida' || newEtapa === 'cierre_perdido' || newEtapa === 'inactivo';
        if (isWon || isLost) {
          newContacts = state.contacts.map((c) =>
            c.id === opp.contactId ? { ...c, etapa: isWon ? 'activo' : 'cierre_perdido' } : c,
          );
        }
      }

      const newOpportunities = state.opportunities.map((o) =>
        o.id === id ? { ...o, ...merged } : o,
      );

      return {
        opportunities: newOpportunities,
        contacts: newContacts,
      };
    });
  },

  getOpportunitiesByContactId: (contactId) => {
    return get().opportunities.filter((o) => o.contactId === contactId);
  },
}));

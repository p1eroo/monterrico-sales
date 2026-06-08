import { create } from 'zustand';
import type { Contact, Opportunity } from '@/types';

/**
 * Filas optimistas mientras se completa POST en la API.
 * Separado de crmStore para no mezclar datos mock con reconciliación explícita.
 */
interface OptimisticCrmState {
  pendingContacts: Contact[];
  pendingOpportunities: Opportunity[];
  addPendingContact: (contact: Contact) => void;
  removePendingContact: (clientId: string) => void;
  addPendingOpportunity: (opportunity: Opportunity) => void;
  removePendingOpportunity: (clientId: string) => void;
  isPendingContactId: (id: string) => boolean;
  isPendingOpportunityId: (id: string) => boolean;
}

export const useOptimisticCrmStore = create<OptimisticCrmState>((set, get) => ({
  pendingContacts: [],
  pendingOpportunities: [],

  addPendingContact: (contact) =>
    set((s) => ({ pendingContacts: [contact, ...s.pendingContacts] })),

  removePendingContact: (clientId) =>
    set((s) => ({
      pendingContacts: s.pendingContacts.filter((c) => c.id !== clientId),
    })),

  addPendingOpportunity: (opportunity) =>
    set((s) => ({
      pendingOpportunities: [opportunity, ...s.pendingOpportunities],
    })),

  removePendingOpportunity: (clientId) =>
    set((s) => ({
      pendingOpportunities: s.pendingOpportunities.filter((o) => o.id !== clientId),
    })),

  isPendingContactId: (id) => get().pendingContacts.some((c) => c.id === id),

  isPendingOpportunityId: (id) =>
    get().pendingOpportunities.some((o) => o.id === id),
}));

export function generateOptimisticId(prefix: 'c' | 'o'): string {
  return `${prefix}_opt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

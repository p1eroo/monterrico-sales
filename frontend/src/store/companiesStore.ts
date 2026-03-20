import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Company, CompanyRubro, CompanyTipo } from '@/types';

function generateId(): string {
  return `emp_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface CreateCompanyData {
  name: string;
  domain?: string;
  rubro?: CompanyRubro;
  tipo?: CompanyTipo;
}

interface CompaniesState {
  companies: Company[];
  addCompany: (data: CreateCompanyData) => Company;
  updateCompany: (id: string, updates: Partial<CreateCompanyData>) => void;
  deleteCompany: (id: string) => void;
  getCompanyByName: (name: string) => Company | undefined;
}

export const useCompaniesStore = create<CompaniesState>()(
  persist(
    (set, get) => ({
      companies: [],

      addCompany: (data) => {
        const now = new Date().toISOString().slice(0, 10);
        const newCompany: Company = {
          id: generateId(),
          name: data.name.trim(),
          domain: data.domain?.trim() || undefined,
          rubro: data.rubro,
          tipo: data.tipo,
          createdAt: now,
        };
        set((state) => ({ companies: [newCompany, ...state.companies] }));
        return newCompany;
      },

      updateCompany: (id, updates) => {
        set((state) => ({
          companies: state.companies.map((c) =>
            c.id === id ? { ...c, ...updates } : c
          ),
        }));
      },

      deleteCompany: (id) => {
        set((state) => ({
          companies: state.companies.filter((c) => c.id !== id),
        }));
      },

      getCompanyByName: (name) => {
        const key = name.trim().toLowerCase();
        return get().companies.find(
          (c) => c.name.trim().toLowerCase() === key
        );
      },
    }),
    { name: 'monterrico-companies' }
  )
);

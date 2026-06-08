import { api } from './api';

export interface FactilizaRucData {
  numero: string;
  nombre_o_razon_social: string;
  tipo_contribuyente?: string;
  estado?: string;
  condicion?: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  direccion_completa?: string;
}

export const factilizaApi = {
  consultarRuc: (ruc: string) =>
    api<FactilizaRucData>(`/factiliza/ruc/${encodeURIComponent(ruc.trim().replace(/\D/g, ''))}`),
};

import { api } from './api';

export interface FactilizaDniData {
  numero: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo: string;
  departamento?: string;
  provincia?: string;
  distrito?: string;
  direccion?: string;
  direccion_completa?: string;
}

export interface FactilizaCeeData {
  numero: string;
  nombres: string;
  apellido_paterno: string;
  apellido_materno: string;
  nombre_completo?: string;
}

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
  consultarDni: (dni: string) =>
    api<FactilizaDniData>(`/factiliza/dni/${encodeURIComponent(dni.trim().replace(/\D/g, ''))}`),

  consultarCee: (cee: string) =>
    api<FactilizaCeeData>(`/factiliza/cee/${encodeURIComponent(cee.trim())}`),

  consultarRuc: (ruc: string) =>
    api<FactilizaRucData>(`/factiliza/ruc/${encodeURIComponent(ruc.trim().replace(/\D/g, ''))}`),
};
